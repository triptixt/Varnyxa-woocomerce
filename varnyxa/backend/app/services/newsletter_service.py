import io
import csv
import secrets
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.newsletter import NewsletterSubscriber
from app.schemas.newsletter import (
    NewsletterSubscribeResponse,
    NewsletterUnsubscribeResponse,
    NewsletterStatusResponse,
    NewsletterSubscriberItem,
    NewsletterAdminListResponse,
)

logger = logging.getLogger("varnyxa.newsletter")


class NewsletterService:
    @staticmethod
    def is_email_provider_configured() -> bool:
        """Checks if an actual SMTP server is configured in backend settings."""
        return bool(settings.SMTP_HOST and settings.SMTP_HOST.strip())

    @classmethod
    def _send_welcome_email(cls, to_email: str, unsubscribe_token: str) -> bool:
        """
        Sends genuine welcome email via SMTP if configured.
        Never pretends an email was sent if provider is unconfigured.
        """
        if not cls.is_email_provider_configured():
            logger.info(
                f"Skipping welcome email to {to_email}: SMTP_HOST is not configured in backend environment."
            )
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Welcome to the VARNYXA Club | Couture & Exclusive Privileges"
            msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
            msg["To"] = to_email

            frontend_base = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
            unsub_link = f"{frontend_base.rstrip('/')}/unsubscribe?token={unsubscribe_token}"

            html_body = f"""
            <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #FAF9F6; color: #121212; border: 1px solid #E8E6E1; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h1 style="letter-spacing: 0.25em; font-size: 24px; font-weight: 800; margin: 0; color: #121212;">VARNYXA</h1>
                    <p style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #C5A880; margin-top: 5px;">High Fashion & Bespoke Tailoring</p>
                </div>
                <div style="background-color: #FFFFFF; padding: 25px; border-radius: 8px; border: 1px solid #E8E6E1;">
                    <h2 style="font-size: 18px; margin-top: 0; color: #121212;">Welcome to the Inner Circle</h2>
                    <p style="font-size: 14px; line-height: 1.6; color: #4A4A4A;">
                        Thank you for joining the <strong>VARNYXA Club</strong>. As an esteemed member, you will receive privileged early previews of seasonal collections, private atelier invitations, and bespoke editorial announcements.
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #4A4A4A;">
                        Your explicit consent was recorded at <strong>{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</strong>.
                    </p>
                </div>
                <div style="margin-top: 25px; text-align: center; font-size: 11px; color: #8C887B;">
                    <p style="margin: 0;">You are receiving this because you subscribed to the VARNYXA Club.</p>
                    <p style="margin: 8px 0 0 0;">
                        To withdraw consent or unsubscribe at any time, click here: 
                        <a href="{unsub_link}" style="color: #C5A880; text-decoration: underline;">Unsubscribe from VARNYXA Club</a>
                    </p>
                </div>
            </div>
            """
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM_EMAIL, [to_email], msg.as_string())

            logger.info(f"Successfully dispatched welcome email to {to_email}")
            return True
        except Exception as e:
            logger.warning(f"Failed to dispatch welcome email to {to_email}: {str(e)}")
            return False

    @classmethod
    def subscribe(
        cls,
        db: Session,
        email: str,
        source: Optional[str] = "website_club",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> NewsletterSubscribeResponse:
        """
        Subscribes an email to the VARNYXA Club.
        Records consent timestamp, handles duplicate subscriptions idempotently,
        and accurately reports email dispatch state.
        """
        clean_email = email.lower().strip()
        now = datetime.now(timezone.utc)

        existing = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == clean_email).first()

        if existing:
            if existing.status == "active":
                return NewsletterSubscribeResponse(
                    email=clean_email,
                    status="active",
                    message="You are already an active member of the VARNYXA Club.",
                    email_dispatched=False,
                    note="Already subscribed.",
                    is_new_subscriber=False,
                )
            else:
                # Re-activate subscription with updated consent timestamp
                existing.status = "active"
                existing.consent_at = now
                existing.unsubscribed_at = None
                existing.unsubscribe_token = secrets.token_urlsafe(32)
                existing.source = source or existing.source
                if ip_address:
                    existing.ip_address = ip_address
                if user_agent:
                    existing.user_agent = user_agent
                db.commit()
                db.refresh(existing)

                dispatched = cls._send_welcome_email(clean_email, existing.unsubscribe_token)
                note = None if dispatched else (
                    "Re-subscribed successfully in database. Welcome email requires SMTP server configuration."
                    if not cls.is_email_provider_configured() else "Email delivery pending."
                )

                return NewsletterSubscribeResponse(
                    email=clean_email,
                    status="active",
                    message="Welcome back to the VARNYXA Club! Your subscription is active.",
                    email_dispatched=dispatched,
                    note=note,
                    is_new_subscriber=False,
                )

        # Create new subscriber
        new_token = secrets.token_urlsafe(32)
        subscriber = NewsletterSubscriber(
            email=clean_email,
            status="active",
            consent_at=now,
            unsubscribe_token=new_token,
            source=source or "website_club",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(subscriber)
        db.commit()
        db.refresh(subscriber)

        dispatched = cls._send_welcome_email(clean_email, new_token)
        note = None if dispatched else (
            "Subscription registered in database. Confirmation email dispatch requires SMTP provider configuration in backend/.env."
            if not cls.is_email_provider_configured() else "Email queued."
        )

        return NewsletterSubscribeResponse(
            email=clean_email,
            status="active",
            message="Welcome to the VARNYXA Club. Thank you for subscribing to our private atelier previews.",
            email_dispatched=dispatched,
            note=note,
        )

    @staticmethod
    def get_status_by_email(db: Session, email: str) -> NewsletterStatusResponse:
        clean_email = email.lower().strip()
        subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == clean_email).first()
        if not subscriber:
            return NewsletterStatusResponse(
                email=clean_email,
                is_subscribed=False,
                status="not_found",
            )
        return NewsletterStatusResponse(
            email=clean_email,
            is_subscribed=(subscriber.status == "active"),
            status=subscriber.status,
            consent_at=subscriber.consent_at,
            unsubscribed_at=subscriber.unsubscribed_at,
        )

    @staticmethod
    def get_info_by_token(db: Session, token: str) -> NewsletterSubscriber:
        clean_token = token.strip()
        subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.unsubscribe_token == clean_token).first()
        if not subscriber:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired unsubscribe link.",
            )
        return subscriber

    @staticmethod
    def unsubscribe(db: Session, token: str, reason: Optional[str] = None) -> NewsletterUnsubscribeResponse:
        clean_token = token.strip()
        subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.unsubscribe_token == clean_token).first()
        if not subscriber:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription record not found for this cancellation token.",
            )

        if subscriber.status == "unsubscribed":
            return NewsletterUnsubscribeResponse(
                email=subscriber.email,
                status="unsubscribed",
                message="You have already been unsubscribed from the VARNYXA Club.",
            )

        subscriber.status = "unsubscribed"
        subscriber.unsubscribed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(subscriber)

        logger.info(f"Subscriber {subscriber.email} unsubscribed successfully. Reason: {reason or 'Not specified'}")

        return NewsletterUnsubscribeResponse(
            email=subscriber.email,
            status="unsubscribed",
            message="You have been successfully unsubscribed from the VARNYXA Club. We respect your preferences.",
        )

    @staticmethod
    def list_subscribers_admin(
        db: Session,
        search: Optional[str] = None,
        status_filter: Optional[str] = "all",
        page: int = 1,
        limit: int = 25,
    ) -> NewsletterAdminListResponse:
        """Admin-only search, filter, and pagination of newsletter subscribers."""
        query = db.query(NewsletterSubscriber)

        if status_filter and status_filter.lower() != "all":
            query = query.filter(NewsletterSubscriber.status == status_filter.lower().strip())

        if search and search.strip():
            query = query.filter(NewsletterSubscriber.email.ilike(f"%{search.strip().lower()}%"))

        total = query.count()
        active_count = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.status == "active").count()
        unsubscribed_count = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.status == "unsubscribed").count()

        offset = (page - 1) * limit
        items = query.order_by(desc(NewsletterSubscriber.created_at)).offset(offset).limit(limit).all()

        return NewsletterAdminListResponse(
            subscribers=[NewsletterSubscriberItem.model_validate(s) for s in items],
            total=total,
            active_count=active_count,
            unsubscribed_count=unsubscribed_count,
            page=page,
            limit=limit,
        )

    @staticmethod
    def update_subscriber_status_admin(db: Session, subscriber_id: str, new_status: str) -> NewsletterSubscriberItem:
        subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.id == subscriber_id).first()
        if not subscriber:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found.")

        subscriber.status = new_status
        if new_status == "unsubscribed" and not subscriber.unsubscribed_at:
            subscriber.unsubscribed_at = datetime.now(timezone.utc)
        elif new_status == "active":
            subscriber.unsubscribed_at = None
            subscriber.consent_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(subscriber)
        return NewsletterSubscriberItem.model_validate(subscriber)

    @staticmethod
    def export_csv(db: Session) -> str:
        """Generates standard CSV of all subscribers with consent timestamps for compliance."""
        subscribers = db.query(NewsletterSubscriber).order_by(desc(NewsletterSubscriber.created_at)).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID",
            "Email",
            "Status",
            "Consent Timestamp (UTC)",
            "Unsubscribed Timestamp (UTC)",
            "Source",
            "IP Address",
            "Created At (UTC)",
        ])

        for s in subscribers:
            writer.writerow([
                s.id,
                s.email,
                s.status,
                s.consent_at.isoformat() if s.consent_at else "",
                s.unsubscribed_at.isoformat() if s.unsubscribed_at else "",
                s.source,
                s.ip_address or "",
                s.created_at.isoformat() if s.created_at else "",
            ])

        return output.getvalue()
