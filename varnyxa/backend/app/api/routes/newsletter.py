from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.newsletter import (
    NewsletterSubscribeRequest,
    NewsletterSubscribeResponse,
    NewsletterUnsubscribeRequest,
    NewsletterUnsubscribeResponse,
    NewsletterStatusResponse,
)
from app.services.newsletter_service import NewsletterService

router = APIRouter(prefix="/newsletter", tags=["Newsletter & Club Membership"])


@router.post("/subscribe", response_model=NewsletterSubscribeResponse, status_code=status.HTTP_201_CREATED)
def subscribe_to_newsletter(
    data: NewsletterSubscribeRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Subscribes a customer to the VARNYXA Club.
    Enforces email validation, captures explicit consent timestamp,
    handles repeats idempotently, and checks email dispatch capability.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return NewsletterService.subscribe(
        db=db,
        email=data.email,
        source=data.source,
        ip_address=client_ip,
        user_agent=user_agent,
    )


@router.get("/status", response_model=NewsletterStatusResponse)
def get_newsletter_status(
    email: str = Query(..., description="Email address to check"),
    db: Session = Depends(get_db),
):
    """Checks the subscription and consent status of a given email."""
    return NewsletterService.get_status_by_email(db=db, email=email)


@router.post("/unsubscribe", response_model=NewsletterUnsubscribeResponse)
def unsubscribe_from_newsletter(
    data: NewsletterUnsubscribeRequest,
    db: Session = Depends(get_db),
):
    """
    Compliant one-click unsubscribe endpoint using cryptographic token.
    Updates PostgreSQL subscription state and timestamps immediately.
    """
    return NewsletterService.unsubscribe(db=db, token=data.token, reason=data.reason)


@router.get("/unsubscribe-info")
def get_unsubscribe_info(
    token: str = Query(..., description="Unsubscribe verification token"),
    db: Session = Depends(get_db),
):
    """Validates the unsubscribe token and returns safe public record info for the unsubscribe confirmation page."""
    sub = NewsletterService.get_info_by_token(db=db, token=token)
    email = sub.email
    if "@" in email:
        local, domain = email.split("@", 1)
        if len(local) > 2:
            masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"
        elif len(local) == 2:
            masked_local = f"{local[0]}*"
        else:
            masked_local = "*"
        masked_email = f"{masked_local}@{domain}"
    else:
        masked_email = "***"

    return {
        "email": email,
        "masked_email": masked_email,
        "status": sub.status,
        "subscribed_at": sub.consent_at,
        "consent_at": sub.consent_at,
        "valid": True,
    }
