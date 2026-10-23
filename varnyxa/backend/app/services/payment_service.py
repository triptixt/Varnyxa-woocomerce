import hmac
import hashlib
import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import razorpay

from app.models.order import Order, Payment, OrderStatus, PaymentProvider, PaymentStatus
from app.models.user import User
from app.schemas.payment import RazorpayOrderResponse, RazorpayVerifyRequest
from app.core.config import settings


from datetime import datetime, timezone
import logging

logger = logging.getLogger("varnyxa.payments.razorpay")


class PaymentService:
    @classmethod
    def get_credentials(cls) -> tuple[str, str, str]:
        """
        Dynamically reads Razorpay credentials from settings or directly from backend/.env.
        Ensures any newly entered keys take effect immediately without requiring a uvicorn restart.
        """
        key_id = settings.RAZORPAY_KEY_ID.strip() if settings.RAZORPAY_KEY_ID else ""
        key_secret = settings.RAZORPAY_KEY_SECRET.strip() if settings.RAZORPAY_KEY_SECRET else ""
        webhook_sec = settings.RAZORPAY_WEBHOOK_SECRET.strip() if settings.RAZORPAY_WEBHOOK_SECRET else ""

        from app.core.config import ENV_FILE_PATH
        if ENV_FILE_PATH.exists():
            try:
                with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k == "RAZORPAY_KEY_ID" and v:
                            key_id = v
                            settings.RAZORPAY_KEY_ID = v
                        elif k == "RAZORPAY_KEY_SECRET" and v:
                            key_secret = v
                            settings.RAZORPAY_KEY_SECRET = v
                        elif k == "RAZORPAY_WEBHOOK_SECRET" and v:
                            webhook_sec = v
                            settings.RAZORPAY_WEBHOOK_SECRET = v
            except Exception as e:
                logger.debug("Failed reading .env for Razorpay keys: %s", e)

        return key_id, key_secret, webhook_sec

    @classmethod
    def is_razorpay_configured(cls) -> bool:
        key_id, key_secret, _ = cls.get_credentials()
        return bool(key_id and key_secret)

    @classmethod
    def get_diagnostics(cls) -> Dict[str, Any]:
        """
        Returns safe, non-sensitive diagnostic information about the Razorpay configuration.
        Indicates whether each setting is configured without revealing any secret keys.
        """
        key_id, key_secret, webhook_sec = cls.get_credentials()

        is_test = key_id.startswith("rzp_test_")
        is_live = key_id.startswith("rzp_live_")

        # Mask key_id safely: rzp_test_****1234
        masked_key_id = (key_id[:9] + "****" + key_id[-4:]) if len(key_id) > 13 else ("****" if key_id else None)

        status_msg = "Ready for Test Mode" if (is_test and key_secret) else (
            "Ready for Production" if (is_live and key_secret) else (
                "Partially Configured (Secret Missing)" if (key_id and not key_secret) else "Credentials Unconfigured in backend/.env"
            )
        )

        return {
            "is_configured": bool(key_id and key_secret),
            "key_id_configured": bool(key_id),
            "key_id_masked": masked_key_id,
            "key_secret_configured": bool(key_secret),
            "webhook_secret_configured": bool(webhook_sec),
            "is_test_mode": is_test,
            "is_live_mode": is_live,
            "gateway_status": status_msg,
        }

    @classmethod
    def get_razorpay_client(cls) -> razorpay.Client:
        key_id, key_secret, _ = cls.get_credentials()
        if not (key_id and key_secret):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Razorpay payment gateway is not configured. Please supply RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env (ensure the file is saved with Ctrl+S).",
            )
        return razorpay.Client(auth=(key_id, key_secret))

    @staticmethod
    def create_razorpay_order(
        db: Session,
        order_id: str,
        user: User,
        payment_method: Optional[str] = None
    ) -> RazorpayOrderResponse:
        from app.models.user import UserRole
        query = db.query(Order).filter(Order.id == order_id)
        if getattr(user, "role", None) != UserRole.ADMIN:
            query = query.filter(Order.user_id == user.id)
        order = query.first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        if order.status == OrderStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancelled orders cannot be paid.")

        if order.status in [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This order has already been confirmed and paid.",
            )

        # If Razorpay keys are not provided yet, provide a clear response informing user how to configure test keys
        if not PaymentService.is_razorpay_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Razorpay API credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env to enable online checkout.",
            )

        client = PaymentService.get_razorpay_client()
        amount_in_paise = int(round(float(order.total_amount) * 100))
        if amount_in_paise <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order payable amount must be greater than zero.")

        try:
            rp_order = client.order.create({
                "amount": amount_in_paise,
                "currency": order.currency or "INR",
                "receipt": order.order_number,
                "notes": {
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "customer_id": user.id,
                    "payment_method": payment_method or "all",
                }
            })

            # Update or create payment record
            payment = db.query(Payment).filter(
                Payment.order_id == order.id,
                Payment.provider == PaymentProvider.RAZORPAY
            ).first()
            if not payment:
                payment = Payment(
                    order_id=order.id,
                    provider=PaymentProvider.RAZORPAY,
                    status=PaymentStatus.PENDING,
                    amount=order.total_amount,
                    currency=order.currency or "INR",
                )
                db.add(payment)

            payment.provider = PaymentProvider.RAZORPAY
            payment.razorpay_order_id = rp_order["id"]
            payment.merchant_order_id = f"ORD-{order.order_number}"
            payment.reference_id = order.payment_reference_id or f"PAYREF-{order.order_number}"
            payment.payment_method = (payment_method or "all").upper()
            payment.status = PaymentStatus.PENDING

            qr_id: Optional[str] = None
            qr_image_url: Optional[str] = None
            qr_data: Optional[str] = None

            # When customer selects UPI, attempt to create official Razorpay dynamic QR code
            if payment_method and payment_method.lower() == "upi":
                try:
                    rp_qr = client.qrcode.create({
                        "type": "upi_qr",
                        "name": f"VARNYXA - {order.order_number}",
                        "usage": "single_use",
                        "fixed_amount": True,
                        "payment_amount": amount_in_paise,
                        "description": f"Payment for Order {order.order_number}",
                        "notes": {
                            "order_id": order.id,
                            "order_number": order.order_number,
                            "customer_id": user.id,
                        }
                    })
                    qr_id = rp_qr.get("id")
                    qr_image_url = rp_qr.get("image_url")
                    qr_data = rp_qr.get("payload") or rp_qr.get("qr_string") or qr_image_url
                except Exception as qr_err:
                    logger.info(
                        "Direct Razorpay QR creation skipped or feature inactive: %s. Using Razorpay SDK UPI block flow.",
                        qr_err
                    )

            db.commit()

            key_id, _, _ = PaymentService.get_credentials()
            return RazorpayOrderResponse(
                razorpay_order_id=rp_order["id"],
                amount=amount_in_paise,
                currency=order.currency or "INR",
                key_id=key_id,
                order_number=order.order_number,
                customer_name=user.full_name or "Valued Customer",
                customer_email=user.email,
                customer_phone=user.phone,
                payment_method=payment_method,
                qr_id=qr_id,
                qr_image_url=qr_image_url,
                qr_data=qr_data,
            )
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Razorpay order initialization failed: {str(e)}",
            )

    @staticmethod
    def get_order_payment_status(db: Session, order_id: str, user: Optional[User] = None) -> Dict[str, Any]:
        """
        Reconciles payment status with Razorpay for real-time order confirmation.
        """
        from app.models.user import UserRole
        query = db.query(Order).filter(Order.id == order_id)
        if user and user.role != UserRole.ADMIN:
            query = query.filter(Order.user_id == user.id)
        order = query.first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        if not payment:
            return {
                "order_id": order.id,
                "order_number": order.order_number,
                "payment_status": PaymentStatus.PENDING,
                "order_status": order.status.value if hasattr(order.status, 'value') else str(order.status),
                "razorpay_order_id": None,
                "razorpay_payment_id": None,
                "amount": float(order.total_amount),
                "currency": order.currency,
            }

        if payment.status == PaymentStatus.CAPTURED:
            return {
                "order_id": order.id,
                "order_number": order.order_number,
                "payment_status": PaymentStatus.CAPTURED,
                "order_status": order.status.value if hasattr(order.status, 'value') else str(order.status),
                "razorpay_order_id": payment.razorpay_order_id,
                "razorpay_payment_id": payment.razorpay_payment_id,
                "amount": float(order.total_amount),
                "currency": order.currency,
                "verified_at": payment.verified_at,
            }

        # Check with Razorpay API if configured and order exists
        if PaymentService.is_razorpay_configured() and payment.razorpay_order_id:
            try:
                client = PaymentService.get_razorpay_client()
                payments_resp = client.order.payments(payment.razorpay_order_id)
                items = payments_resp.get("items", []) if isinstance(payments_resp, dict) else []
                for p in items:
                    if p.get("status") == "captured":
                        payment.status = PaymentStatus.CAPTURED
                        payment.razorpay_payment_id = p.get("id")
                        payment.verified_at = datetime.now(timezone.utc)
                        order.status = OrderStatus.CONFIRMED
                        db.commit()
                        return {
                            "order_id": order.id,
                            "order_number": order.order_number,
                            "payment_status": PaymentStatus.CAPTURED,
                            "order_status": order.status.value if hasattr(order.status, 'value') else str(order.status),
                            "razorpay_order_id": payment.razorpay_order_id,
                            "razorpay_payment_id": payment.razorpay_payment_id,
                            "amount": float(order.total_amount),
                            "currency": order.currency,
                            "verified_at": payment.verified_at,
                        }
            except Exception as e:
                logger.debug("Razorpay polling status check error: %s", e)

        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": payment.status,
            "order_status": order.status.value if hasattr(order.status, 'value') else str(order.status),
            "razorpay_order_id": payment.razorpay_order_id,
            "razorpay_payment_id": payment.razorpay_payment_id,
            "amount": float(order.total_amount),
            "currency": order.currency,
            "verified_at": payment.verified_at,
        }

    @staticmethod
    def verify_payment(db: Session, data: RazorpayVerifyRequest, user: User) -> bool:
        from app.models.user import UserRole
        query = db.query(Order).filter(Order.id == data.order_id)
        if getattr(user, "role", None) != UserRole.ADMIN:
            query = query.filter(Order.user_id == user.id)
        order = query.first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        # Check existing payment record for idempotency
        payment = db.query(Payment).filter(
            Payment.order_id == order.id,
            Payment.provider == PaymentProvider.RAZORPAY
        ).first()

        if payment and payment.status == PaymentStatus.CAPTURED:
            # Already captured and confirmed - idempotent success
            return True

        if not PaymentService.is_razorpay_configured():
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Razorpay is not configured.")

        # Compute HMAC SHA256 signature
        _, key_secret, _ = PaymentService.get_credentials()
        generated_signature = hmac.new(
            key_secret.encode("utf-8"),
            f"{data.razorpay_order_id}|{data.razorpay_payment_id}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(generated_signature, data.razorpay_signature):
            if payment:
                payment.status = PaymentStatus.FAILED
                payment.error_description = "Cryptographic signature mismatch."
                db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment signature verification failed.",
            )

        # Signature is valid - update payment and order status idempotently
        if not payment:
            payment = Payment(
                order_id=order.id,
                provider=PaymentProvider.RAZORPAY,
                amount=order.total_amount,
                currency=order.currency or "INR",
            )
            db.add(payment)

        payment.razorpay_order_id = data.razorpay_order_id
        payment.razorpay_payment_id = data.razorpay_payment_id
        payment.razorpay_signature = data.razorpay_signature
        payment.merchant_order_id = f"ORD-{order.order_number}"
        payment.reference_id = order.payment_reference_id or f"PAYREF-{order.order_number}"
        payment.status = PaymentStatus.CAPTURED
        payment.verified_at = datetime.now(timezone.utc)

        order.status = OrderStatus.CONFIRMED
        db.commit()
        return True

    @staticmethod
    def process_webhook(db: Session, payload_body: bytes, signature_header: str) -> Dict[str, Any]:
        if not settings.RAZORPAY_WEBHOOK_SECRET:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook secret unconfigured.")

        expected_sig = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            payload_body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature_header):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature.")

        import json
        event = json.loads(payload_body.decode("utf-8"))
        event_name = event.get("event")

        if event_name in ("payment.captured", "order.paid"):
            payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
            order_entity = event.get("payload", {}).get("order", {}).get("entity", {})
            rp_order_id = payment_entity.get("order_id") or order_entity.get("id")
            rp_payment_id = payment_entity.get("id")

            if rp_order_id:
                payment = db.query(Payment).filter(Payment.razorpay_order_id == rp_order_id).first()
                if payment and payment.status != PaymentStatus.CAPTURED:
                    payment.status = PaymentStatus.CAPTURED
                    if rp_payment_id:
                        payment.razorpay_payment_id = rp_payment_id
                    payment.verified_at = datetime.now(timezone.utc)
                    if payment.order:
                        payment.order.status = OrderStatus.CONFIRMED
                    db.commit()

        elif event_name == "payment.failed":
            payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
            rp_order_id = payment_entity.get("order_id")
            error_desc = payment_entity.get("error_description") or payment_entity.get("error_reason")
            if rp_order_id:
                payment = db.query(Payment).filter(Payment.razorpay_order_id == rp_order_id).first()
                if payment and payment.status != PaymentStatus.CAPTURED:
                    payment.status = PaymentStatus.FAILED
                    payment.error_description = error_desc
                    db.commit()

        return {"status": "ok", "event": event_name}

    @staticmethod
    def complete_demo_payment(
        db: Session,
        order_id: str,
        user: User,
        payment_method: Optional[str] = "UPI QR (Seamless Demo)",
        reference_id: Optional[str] = None,
    ) -> Order:
        """
        Persists a distinct demo payment transaction in the PostgreSQL database.
        Stores the demo transaction reference, sets provider=PaymentProvider.DEMO and
        status=PaymentStatus.DEMO_COMPLETED.
        Updates order.status=OrderStatus.CONFIRMED.
        Guarantees demo transactions NEVER mark real Razorpay or PayYantra payments as captured.
        """
        from app.models.user import UserRole
        query = db.query(Order).filter(Order.id == order_id)
        if getattr(user, "role", None) != UserRole.ADMIN:
            query = query.filter(Order.user_id == user.id)
        order = query.first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        if order.status == OrderStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancelled orders cannot be paid.")

        demo_ref = reference_id or order.payment_reference_id or f"PAYREF-DEMO-{order.order_number}"

        # Look for existing demo payment or pending payment for this order
        payment = db.query(Payment).filter(
            Payment.order_id == order.id,
            Payment.provider == PaymentProvider.DEMO
        ).first()

        if not payment:
            # Check for any pending payment created initially
            payment = db.query(Payment).filter(
                Payment.order_id == order.id,
                Payment.status == PaymentStatus.PENDING
            ).first()

        if not payment:
            payment = Payment(
                order_id=order.id,
                provider=PaymentProvider.DEMO,
                amount=order.total_amount,
                currency=order.currency or "INR",
            )
            db.add(payment)

        # Set distinct demo payment properties
        payment.provider = PaymentProvider.DEMO
        payment.status = PaymentStatus.DEMO_COMPLETED
        payment.payment_method = payment_method or "UPI QR (Seamless Demo)"
        payment.reference_id = demo_ref
        payment.merchant_order_id = f"ORD-DEMO-{order.order_number}"
        payment.transaction_id = f"TXN-DEMO-{order.order_number}"
        payment.rrn = "RRN-DEMO-998822"
        payment.verified_at = datetime.now(timezone.utc)
        payment.gateway_response = {
            "mode": "demo",
            "provider": "seamless_upi",
            "demo_payload": "VARNYXA-DEMO-TRANSACTION-12345",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        # Update order status to CONFIRMED (order placed & payment confirmed via demo)
        order.status = OrderStatus.CONFIRMED
        if not order.payment_reference_id:
            order.payment_reference_id = demo_ref

        db.commit()
        db.refresh(order)
        return order

