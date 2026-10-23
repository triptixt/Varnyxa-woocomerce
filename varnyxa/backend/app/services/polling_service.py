import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.order import Order, OrderStatus, Payment, PaymentProvider, PaymentStatus
from app.models.subscription import UserSubscription
from app.models.settings import StoreSetting
from app.services.payyantra_service import PayYantraService
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger("payyantra.polling")


class PollingService:
    """
    Automated Order and Payment Status Polling Service.
    Periodically synchronizes pending orders and subscription purchases with PayYantra.
    Provides idempotent updates, safe logging, exponential backoff retries,
    and PostgreSQL row locking (skip_locked=True) across multiple workers.
    """

    _is_polling = False
    _background_task: Optional[asyncio.Task] = None
    _last_poll_state: Dict[str, Any] = {
        "last_polled_at": None,
        "status": "idle",
        "orders_checked": 0,
        "subscriptions_checked": 0,
        "orders_updated": 0,
        "subscriptions_updated": 0,
        "last_error": None,
    }

    @classmethod
    def get_polling_status(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """Returns the current state and metrics of the payment polling service."""
        state = dict(cls._last_poll_state)
        # Check if persisted in StoreSetting
        if db:
            setting = db.query(StoreSetting).filter(StoreSetting.key == "payyantra_polling_status").first()
            if setting and setting.value:
                try:
                    val = json.loads(setting.value) if isinstance(setting.value, str) else setting.value
                    if isinstance(val, dict):
                        state.update(val)
                except Exception:
                    pass
        state["interval_seconds"] = settings.PAYYANTRA_POLL_INTERVAL_SECONDS
        state["max_retries"] = settings.PAYYANTRA_POLL_MAX_RETRIES
        state["max_pending_minutes"] = settings.PAYYANTRA_MAX_PENDING_MINUTES
        state["is_gateway_configured"] = PayYantraService.is_configured()
        return state

    @classmethod
    def poll_all_pending(cls, db: Session) -> Dict[str, Any]:
        """
        Polls PayYantra for all pending orders and subscription purchases.
        Idempotent: updates local states only upon verified provider responses.
        """
        if cls._is_polling:
            logger.info("Polling run already in progress. Skipping overlapping run.")
            return {"status": "skipped", "reason": "Already running"}

        cls._is_polling = True
        now = datetime.now(timezone.utc)
        max_pending_threshold = now - timedelta(minutes=settings.PAYYANTRA_MAX_PENDING_MINUTES)

        orders_checked = 0
        orders_updated = 0
        subs_checked = 0
        subs_updated = 0
        poll_error: Optional[str] = None

        try:
            if not PayYantraService.is_configured():
                cls._last_poll_state = {
                    "last_polled_at": now.isoformat(),
                    "status": "skipped",
                    "orders_checked": 0,
                    "subscriptions_checked": 0,
                    "orders_updated": 0,
                    "subscriptions_updated": 0,
                    "last_error": "PayYantra credentials not configured in backend/.env",
                }
                return cls._last_poll_state

            # -------------------------------------------------------------
            # 1. Poll Pending Orders
            # -------------------------------------------------------------
            pending_payments = (
                db.query(Payment)
                .filter(
                    Payment.status == PaymentStatus.PENDING,
                    Payment.provider == PaymentProvider.PAYYANTRA,
                    Payment.poll_count < settings.PAYYANTRA_POLL_MAX_RETRIES,
                )
                .order_by(Payment.created_at.asc())
                .limit(50)
                .with_for_update(skip_locked=True)
                .all()
            )
            orders_checked = len(pending_payments)

            for payment in pending_payments:
                order = db.query(Order).filter(Order.id == payment.order_id).first()
                if not order:
                    continue

                # Check if transaction expired beyond maximum pending window (e.g. 45 mins)
                is_expired = payment.created_at < max_pending_threshold

                try:
                    gw_data = {}
                    if payment.payyantra_order_id:
                        gw_data = PayYantraService.get_status_by_order_id(payment.payyantra_order_id)
                    if not gw_data and payment.reference_id:
                        gw_data = PayYantraService.get_status_by_reference(payment.reference_id)

                    gw_status = (gw_data.get("status") or "").upper()

                    if gw_status == "SUCCESS":
                        PayYantraService._mark_payment_success(db, order, payment, gw_data)
                        orders_updated += 1
                        logger.info(f"Polling: Order {order.order_number} confirmed SUCCESS via PayYantra.")
                    elif gw_status in ["FAILED", "CANCELLED", "EXPIRED"]:
                        PayYantraService._mark_payment_failed(db, order, payment, gw_data)
                        orders_updated += 1
                        logger.info(f"Polling: Order {order.order_number} marked FAILED via PayYantra.")
                    elif is_expired:
                        # Expire order that exceeded timeout without payment confirmation
                        payment.status = PaymentStatus.FAILED
                        payment.error_code = "SESSION_EXPIRED"
                        payment.error_description = "Payment session expired in gateway."
                        order.status = OrderStatus.CANCELLED
                        payment.last_polled_at = now
                        payment.poll_count += 1
                        db.commit()
                        orders_updated += 1
                        logger.info(f"Polling: Order {order.order_number} expired after {settings.PAYYANTRA_MAX_PENDING_MINUTES}m.")
                    else:
                        payment.poll_count += 1
                        payment.last_polled_at = now
                        db.commit()

                except Exception as exc:
                    logger.warning(f"Polling: Failed to check order {order.order_number}: {str(exc)}")
                    payment.poll_count += 1
                    payment.poll_error = str(exc)[:250]
                    payment.last_polled_at = now
                    db.commit()

            # -------------------------------------------------------------
            # 2. Poll Pending Subscriptions
            # -------------------------------------------------------------
            pending_subs = (
                db.query(UserSubscription)
                .filter(
                    UserSubscription.status == "pending",
                    UserSubscription.payment_status == "pending",
                    UserSubscription.poll_count < settings.PAYYANTRA_POLL_MAX_RETRIES,
                )
                .order_by(UserSubscription.created_at.asc())
                .limit(50)
                .with_for_update(skip_locked=True)
                .all()
            )
            subs_checked = len(pending_subs)

            for sub in pending_subs:
                is_expired = sub.created_at < max_pending_threshold

                try:
                    gw_data = {}
                    if sub.payyantra_order_id:
                        gw_data = PayYantraService.get_status_by_order_id(sub.payyantra_order_id)
                    if not gw_data and sub.payment_reference:
                        gw_data = PayYantraService.get_status_by_reference(sub.payment_reference)

                    gw_status = (gw_data.get("status") or "").upper()

                    if gw_status == "SUCCESS":
                        SubscriptionService.confirm_subscription_payment(db, sub, gw_data)
                        subs_updated += 1
                        logger.info(f"Polling: Subscription {sub.id} ({sub.payment_reference}) activated SUCCESS.")
                    elif gw_status in ["FAILED", "CANCELLED", "EXPIRED"]:
                        SubscriptionService.mark_subscription_failed(db, sub, gw_data)
                        subs_updated += 1
                        logger.info(f"Polling: Subscription {sub.id} marked FAILED via PayYantra.")
                    elif is_expired:
                        sub.status = "cancelled"
                        sub.payment_status = "failed"
                        sub.poll_error = "Subscription checkout session timed out."
                        sub.poll_count += 1
                        sub.last_polled_at = now
                        db.commit()
                        subs_updated += 1
                        logger.info(f"Polling: Subscription {sub.id} timed out.")
                    else:
                        sub.poll_count += 1
                        sub.last_polled_at = now
                        db.commit()

                except Exception as exc:
                    logger.warning(f"Polling: Failed to check subscription {sub.id}: {str(exc)}")
                    sub.poll_count += 1
                    sub.poll_error = str(exc)[:250]
                    sub.last_polled_at = now
                    db.commit()

        except Exception as e:
            poll_error = str(e)
            logger.error(f"Polling execution encountered exception: {poll_error}")
        finally:
            cls._is_polling = False

        status_result = {
            "last_polled_at": now.isoformat(),
            "status": "error" if poll_error else "success",
            "orders_checked": orders_checked,
            "subscriptions_checked": subs_checked,
            "orders_updated": orders_updated,
            "subscriptions_updated": subs_updated,
            "last_error": poll_error,
        }
        cls._last_poll_state = status_result

        # Persist to StoreSetting for admin dashboard visibility
        try:
            status_json = json.dumps(status_result)
            setting = db.query(StoreSetting).filter(StoreSetting.key == "payyantra_polling_status").first()
            if not setting:
                setting = StoreSetting(
                    key="payyantra_polling_status",
                    value=status_json,
                    description="Real-time execution status of PayYantra automated polling job",
                )
                db.add(setting)
            else:
                setting.value = status_json
                setting.updated_at = now
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to persist polling status setting: {str(e)}")

        return status_result

    @classmethod
    async def start_background_loop(cls):
        """Starts the asynchronous polling worker loop in FastAPI."""
        if cls._background_task and not cls._background_task.done():
            return

        async def _loop():
            logger.info(
                f"PayYantra automated polling scheduler started. "
                f"Interval: {settings.PAYYANTRA_POLL_INTERVAL_SECONDS}s, "
                f"Max Retries: {settings.PAYYANTRA_POLL_MAX_RETRIES}."
            )
            while True:
                try:
                    await asyncio.sleep(settings.PAYYANTRA_POLL_INTERVAL_SECONDS)
                    db = SessionLocal()
                    try:
                        cls.poll_all_pending(db)
                    finally:
                        db.close()
                except asyncio.CancelledError:
                    logger.info("PayYantra automated polling scheduler stopped.")
                    break
                except Exception as exc:
                    logger.error(f"Error in background polling iteration: {str(exc)}")

        cls._background_task = asyncio.create_task(_loop())

    @classmethod
    def stop_background_loop(cls):
        """Cancels background polling worker loop on shutdown."""
        if cls._background_task and not cls._background_task.done():
            cls._background_task.cancel()
            cls._background_task = None
