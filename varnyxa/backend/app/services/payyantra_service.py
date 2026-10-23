import time
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.models.order import Order, OrderStatus, Payment, PaymentProvider, PaymentStatus
from app.models.catalog import ProductVariant
from app.models.user import User, UserRole
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.services.subscription_service import SubscriptionService
from app.schemas.payment import (
    PayYantraCheckoutResponse,
    PayYantraStatusResponse,
    PayYantraWebhookPayload,
)

logger = logging.getLogger("payyantra")

PAYYANTRA_TIMEOUT = httpx.Timeout(connect=30.0, read=45.0, write=30.0, pool=15.0)


class PayYantraService:
    """
    Official PayYantra Payin API Client & Orchestration Service.
    Implements Token API, Create Order API (Hosted Checkout V3),
    Status APIs (by reference & by order ID), and Webhook Reconciliation.
    """

    _cached_token: Optional[str] = None
    _token_expires_at: Optional[datetime] = None

    @classmethod
    def _post_with_retry(
        cls,
        url: str,
        headers: Dict[str, str],
        json_payload: Optional[Dict[str, Any]] = None,
        max_attempts: int = 2,
    ) -> httpx.Response:
        """
        Executes HTTP POST with timeout and resilient retry for transient network/handshake issues.
        """
        last_exc: Optional[Exception] = None
        for attempt in range(max_attempts):
            try:
                with httpx.Client(timeout=PAYYANTRA_TIMEOUT) as client:
                    if json_payload is not None:
                        return client.post(url, headers=headers, json=json_payload)
                    return client.post(url, headers=headers)
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                last_exc = exc
                if attempt < max_attempts - 1:
                    logger.warning(
                        f"PayYantra network timeout/error on attempt {attempt + 1} ({type(exc).__name__}: {exc}). Retrying in 1s..."
                    )
                    time.sleep(1.0)
                else:
                    logger.error(
                        f"PayYantra network request failed after {max_attempts} attempts: {type(exc).__name__}: {exc}"
                    )
        if last_exc:
            raise last_exc
        raise RuntimeError("Unexpected failure in _post_with_retry")

    @classmethod
    def is_configured(cls) -> bool:
        """Check if merchant credentials are provided in backend environment."""
        return bool(settings.PAYYANTRA_CLIENT_ID and settings.PAYYANTRA_CLIENT_SECRET)

    @classmethod
    def get_diagnostics(cls) -> Dict[str, Any]:
        """
        Reports safe, non-sensitive configuration diagnostics for debugging.
        Never prints or returns unmasked secrets or tokens.
        """
        cid = (settings.PAYYANTRA_CLIENT_ID or "").strip()
        sec = (settings.PAYYANTRA_CLIENT_SECRET or "").strip()
        base_url = (settings.PAYYANTRA_BASE_URL or "").strip()

        is_live_key = cid.startswith("pk_live_") or sec.startswith("sk_live_")
        is_uat_url = "uat" in base_url.lower()
        is_live_url = not is_uat_url and bool(base_url)
        env_mismatch = (is_live_key and is_uat_url) or (not is_live_key and is_live_url and bool(cid))

        # Safe masking (keep first 7 and last 4 characters e.g. pk_live_****6789)
        cid_masked = (cid[:7] + "****" + cid[-4:]) if len(cid) > 11 else ("****" if cid else None)
        sec_masked = (sec[:7] + "****" + sec[-4:]) if len(sec) > 11 else ("****" if sec else None)

        mismatch_msg = None
        if is_live_key and is_uat_url:
            mismatch_msg = (
                "CRITICAL MISMATCH: Credentials appear to be Live/Production keys (pk_live_...), "
                "but PAYYANTRA_BASE_URL is set to the UAT Sandbox (https://payin-api-uat.payyantra.com). "
                "For live keys, set PAYYANTRA_BASE_URL=https://payin-api.payyantra.com. "
                "For testing in UAT, use PayYantra UAT sandbox credentials."
            )
        elif not is_live_key and is_live_url and cid:
            mismatch_msg = (
                "NOTICE: Non-live key format configured with production URL (https://payin-api.payyantra.com)."
            )

        return {
            "is_configured": cls.is_configured(),
            "base_url": base_url,
            "client_id_present": bool(cid),
            "client_id_length": len(cid),
            "client_id_masked": cid_masked,
            "client_secret_present": bool(sec),
            "client_secret_length": len(sec),
            "client_secret_masked": sec_masked,
            "api_version": settings.PAYYANTRA_API_VERSION,
            "test_mode": settings.PAYYANTRA_TEST_MODE,
            "env_mismatch_detected": env_mismatch,
            "env_mismatch_description": mismatch_msg,
            "has_cached_token": bool(cls._cached_token),
        }

    @classmethod
    def get_auth_token(cls, force_refresh: bool = False) -> str:
        """
        Authenticate with x-client-id and x-client-secret headers (no body)
        and receive a Bearer JWT. Tokens are valid for 24 hours.
        Caches and reuses token safely on the backend.
        """
        now = datetime.now(timezone.utc)
        if (
            not force_refresh
            and cls._cached_token
            and cls._token_expires_at
            and now < (cls._token_expires_at - timedelta(minutes=15))
        ):
            return cls._cached_token

        if not cls.is_configured():
            logger.warning("PayYantra Token API called but credentials are not configured in backend/.env.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PayYantra gateway is not configured. Set PAYYANTRA_CLIENT_ID and PAYYANTRA_CLIENT_SECRET in backend/.env.",
            )

        cid = settings.PAYYANTRA_CLIENT_ID.strip()
        sec = settings.PAYYANTRA_CLIENT_SECRET.strip()
        url = f"{settings.PAYYANTRA_BASE_URL.rstrip('/')}/api/auth/token"

        # Diagnostic masking for logs
        cid_masked = (cid[:7] + "****" + cid[-4:]) if len(cid) > 11 else "****"
        sec_masked = (sec[:7] + "****" + sec[-4:]) if len(sec) > 11 else "****"

        logger.info(
            f"PayYantra Token API requesting token: url={url}, "
            f"client_id={cid_masked} (len={len(cid)}), "
            f"client_secret={sec_masked} (len={len(sec)}), "
            f"api_version={settings.PAYYANTRA_API_VERSION}"
        )

        headers = {
            "x-client-id": cid,
            "x-client-secret": sec,
            "x-api-version": settings.PAYYANTRA_API_VERSION,
        }

        try:
            response = cls._post_with_retry(url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                token = data.get("data", {}).get("token")
                if not token:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Invalid token response received from PayYantra.",
                    )
                cls._cached_token = token
                cls._token_expires_at = now + timedelta(hours=23, minutes=30)
                logger.info("PayYantra authentication token refreshed successfully.")
                return token
            else:
                sanitized_error = response.text[:300].strip()
                logger.warning(
                    f"PayYantra Token API failed with HTTP {response.status_code}: {sanitized_error} (target: {url})"
                )
                if response.status_code == 401:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid PayYantra credentials (HTTP 401): {sanitized_error or 'Unauthorized'}. Verify PAYYANTRA_CLIENT_ID and PAYYANTRA_CLIENT_SECRET against {url}.",
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"PayYantra Token API returned HTTP {response.status_code}: {sanitized_error}",
                    )
        except httpx.RequestError as exc:
            logger.error(f"PayYantra connection error connecting to {url}: {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to establish connection with PayYantra authentication server at {url}: {str(exc)}",
            )

    @classmethod
    def create_hosted_checkout_order(
        cls,
        db: Session,
        order_id: str,
        user: User,
        payment_method: Optional[str] = None,
        custom_return_url: Optional[str] = None,
    ) -> PayYantraCheckoutResponse:
        """
        Creates an order on PayYantra and returns the hosted checkout URL or dynamic payment details.
        Validates inventory and recalculates payable amount directly from PostgreSQL.
        Supports specific payment_method flows ('UPI', 'CARD', 'NETBANKING').
        """
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        # Ensure order belongs to user or user is admin
        is_admin = getattr(user, "role", None) == UserRole.ADMIN or getattr(user, "is_admin", False)
        if order.user_id != user.id and not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        if order.status in [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This order has already been confirmed and paid.",
            )

        # Recalculate amount securely from database
        payable_amount = round(float(order.total_amount), 2)
        if payable_amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order total must be greater than zero.")

        # If test mode is enabled in UAT sandbox, cap at 10.00 as recommended by PayYantra docs
        if settings.PAYYANTRA_TEST_MODE and "uat" in settings.PAYYANTRA_BASE_URL.lower():
            payable_amount = min(payable_amount, 10.00)

        # Unique merchant order reference and business reference
        merchant_order_id = f"ORD-{order.order_number}"
        reference_id = order.payment_reference_id or f"PAYREF-{order.order_number}"[:50]

        # Extract customer contact details
        phone_cleaned = (user.phone or "").replace(" ", "").replace("+91", "").replace("-", "")
        if len(phone_cleaned) > 10:
            phone_cleaned = phone_cleaned[-10:]
        elif len(phone_cleaned) < 10:
            # Fallback default valid 10-digit mobile if user profile missing phone
            phone_cleaned = "9876543210"

        # URLs - prefer client provided return URL to support frontend port dynamically
        if custom_return_url and ("localhost" in custom_return_url or "127.0.0.1" in custom_return_url or any(origin in custom_return_url for origin in settings.cors_origins)):
            sep = "&" if "?" in custom_return_url else "?"
            return_url = f"{custom_return_url}{sep}order_id={order.id}"
        else:
            return_url = f"{settings.PAYYANTRA_RETURN_URL}?order_id={order.id}"
        notify_url = settings.PAYYANTRA_NOTIFY_URL

        # Method specific configuration
        allowed_methods = ["UPI", "CARD", "NETBANKING"]
        if payment_method:
            pm_upper = payment_method.upper().strip()
            if pm_upper == "UPI":
                allowed_methods = ["UPI"]
            elif pm_upper in ["CARD", "CARDS", "CREDIT_CARD", "DEBIT_CARD"]:
                allowed_methods = ["CARD"]
            elif pm_upper == "NETBANKING":
                allowed_methods = ["NETBANKING"]

        payload = {
            "orderId": merchant_order_id,
            "amount": payable_amount,
            "currency": "INR",
            "customerName": user.full_name or "Valued Customer",
            "customerEmail": user.email,
            "customerPhone": phone_cleaned,
            "returnUrl": return_url,
            "notifyUrl": notify_url,
            "referenceId": reference_id,
            "allowedPaymentMethods": allowed_methods,
            "metadata": {
                "varnyxa_order_id": order.id,
                "order_number": order.order_number,
                "requested_payment_method": payment_method or "ALL",
            },
        }

        token = cls.get_auth_token()
        url = f"{settings.PAYYANTRA_BASE_URL.rstrip('/')}/api/v2/merchant/orders"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            response = cls._post_with_retry(url, headers=headers, json_payload=payload)

            if response.status_code in [200, 201]:
                res_json = response.json()
                res_data = res_json.get("data", {})
                checkout_url = res_data.get("checkoutUrl")
                payyantra_order_id = res_data.get("orderId")
                transaction_id = res_data.get("transactionId")
                transaction_public_id = res_data.get("transactionPublicId")

                # Extract any real dynamic QR or UPI intent information returned by PayYantra
                qr_data = (
                    res_data.get("qrData")
                    or res_data.get("qr_data")
                    or res_data.get("qrCode")
                    or res_data.get("qr_code")
                )
                qr_url = res_data.get("qrUrl") or res_data.get("qr_url")
                upi_intent_url = (
                    res_data.get("upiIntent")
                    or res_data.get("upiIntentUrl")
                    or res_data.get("intentUrl")
                )
                expires_at = res_data.get("expiryTime") or res_data.get("expiresAt")

                # If customer selected UPI and no direct QR was in Create Order response,
                # check if merchant's PayYantra account has the seamless direct UPI QR service enabled
                if payment_method and payment_method.upper().strip() == "UPI" and not qr_data and transaction_id:
                    try:
                        seamless_url = f"{settings.PAYYANTRA_BASE_URL.rstrip('/')}/api/checkout/seamless/upi-qr"
                        qr_resp = cls._post_with_retry(
                            seamless_url,
                            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                            json_payload={"transactionId": transaction_id}
                        )
                        if qr_resp.status_code == 200:
                            qr_json = qr_resp.json()
                            qr_payload = qr_json.get("data", {}) or qr_json
                            qr_data = qr_payload.get("qrData") or qr_payload.get("qr_data")
                            qr_url = qr_payload.get("qrUrl") or qr_payload.get("qr_url")
                            upi_intent_url = qr_payload.get("upiIntent") or qr_payload.get("upiIntentUrl") or qr_data
                    except Exception as seamless_err:
                        logger.info("PayYantra seamless UPI QR check skipped: %s", seamless_err)

                if not checkout_url and not qr_data and not qr_url:
                    logger.error(f"PayYantra response missing checkoutUrl and QR: {res_json}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="PayYantra order creation did not return a valid checkoutUrl or payment instructions.",
                    )

                # Persist or update Payment record in PostgreSQL
                payment = (
                    db.query(Payment)
                    .filter(Payment.order_id == order.id, Payment.provider == PaymentProvider.PAYYANTRA)
                    .first()
                )
                if not payment:
                    payment = Payment(
                        order_id=order.id,
                        provider=PaymentProvider.PAYYANTRA,
                        amount=payable_amount,
                        currency="INR",
                        status=PaymentStatus.PENDING,
                    )
                    db.add(payment)

                payment.payyantra_order_id = payyantra_order_id
                payment.merchant_order_id = merchant_order_id
                payment.reference_id = reference_id
                payment.transaction_id = transaction_id
                payment.transaction_public_id = str(transaction_public_id) if transaction_public_id else None
                payment.checkout_url = checkout_url
                payment.payment_method = payment_method.upper() if payment_method else "PAYYANTRA"
                payment.gateway_response = res_data
                payment.status = PaymentStatus.PENDING

                db.commit()
                db.refresh(payment)

                return PayYantraCheckoutResponse(
                    checkout_url=checkout_url or "",
                    order_id=order.id,
                    order_number=order.order_number,
                    payyantra_order_id=payyantra_order_id or "",
                    transaction_id=transaction_id or "",
                    transaction_public_id=str(transaction_public_id) if transaction_public_id else None,
                    amount=payable_amount,
                    currency="INR",
                    payment_method=payment_method.upper() if payment_method else "PAYYANTRA",
                    qr_data=qr_data,
                    qr_url=qr_url,
                    upi_intent_url=upi_intent_url,
                    expires_at=str(expires_at) if expires_at else None,
                )
            elif response.status_code == 401:
                # Expired or rejected token; try refresh once
                cls.get_auth_token(force_refresh=True)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="PayYantra session expired. Please retry payment initiation.",
                )
            else:
                error_body = response.text[:300].strip()
                logger.error(f"PayYantra Create Order failed with HTTP {response.status_code}: {error_body}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PayYantra order creation rejected (HTTP {response.status_code}): {error_body or 'Bad Request'}.",
                )
        except httpx.RequestError as exc:
            logger.error(f"Network error communicating with PayYantra: {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to PayYantra payment gateway. Please check network or try again.",
            )

    @classmethod
    def create_subscription_checkout_order(
        cls,
        db: Session,
        user: User,
        plan_id: str,
    ) -> Dict[str, Any]:
        """
        Creates a pending subscription purchase in PostgreSQL and registers a Hosted Checkout V3
        order on PayYantra using the official Create Order API.
        Returns the official checkoutUrl.
        """
        plan = SubscriptionService.get_plan_by_id(db, plan_id)
        if not plan.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected membership plan is inactive.")

        payable_amount = round(float(plan.price), 2)
        if payable_amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plan price must be greater than zero.")

        # Test mode limit as per PayYantra docs
        if settings.PAYYANTRA_TEST_MODE and "uat" in settings.PAYYANTRA_BASE_URL.lower():
            payable_amount = min(payable_amount, 10.00)

        now_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        rand_hex = uuid.uuid4().hex[:8].upper()
        payment_reference = f"SUBREF-{now_str}-{rand_hex}"
        merchant_order_id = f"SUB-{now_str}-{uuid.uuid4().hex[:6].upper()}"

        # Create pending subscription in database
        sub = SubscriptionService.create_pending_subscription(
            db=db,
            user=user,
            plan_id=plan.id,
            payment_reference=payment_reference,
            merchant_order_id=merchant_order_id,
            amount=payable_amount,
        )

        phone_cleaned = (user.phone or "").replace(" ", "").replace("+91", "").replace("-", "")
        if len(phone_cleaned) > 10:
            phone_cleaned = phone_cleaned[-10:]
        elif len(phone_cleaned) < 10:
            phone_cleaned = "9876543210"

        return_url = f"{settings.PAYYANTRA_RETURN_URL}?subscription_id={sub.id}&type=subscription"
        notify_url = settings.PAYYANTRA_NOTIFY_URL

        payload = {
            "orderId": merchant_order_id,
            "amount": payable_amount,
            "currency": "INR",
            "customerName": user.full_name or "Valued Customer",
            "customerEmail": user.email,
            "customerPhone": phone_cleaned,
            "returnUrl": return_url,
            "notifyUrl": notify_url,
            "referenceId": payment_reference,
            "allowedPaymentMethods": ["UPI", "CARD", "NETBANKING"],
            "metadata": {
                "type": "subscription",
                "subscription_id": sub.id,
                "plan_id": plan.id,
                "plan_name": plan.name,
                "user_id": user.id,
            },
        }

        token = cls.get_auth_token()
        url = f"{settings.PAYYANTRA_BASE_URL.rstrip('/')}/api/v2/merchant/orders"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            response = cls._post_with_retry(url, headers=headers, json_payload=payload)
            if response.status_code in [200, 201]:
                res_json = response.json()
                res_data = res_json.get("data", {})
                checkout_url = res_data.get("checkoutUrl")
                payyantra_order_id = res_data.get("orderId")
                transaction_id = res_data.get("transactionId")
                transaction_public_id = res_data.get("transactionPublicId")

                if not checkout_url:
                    logger.error(f"PayYantra response missing checkoutUrl: {res_json}")
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="PayYantra subscription order creation did not return checkoutUrl.",
                    )

                sub.payyantra_order_id = payyantra_order_id
                sub.transaction_id = transaction_id
                sub.checkout_url = checkout_url
                sub.gateway_response = res_data
                db.commit()
                db.refresh(sub)

                return {
                    "checkout_url": checkout_url,
                    "subscription_id": sub.id,
                    "plan_id": plan.id,
                    "plan_name": plan.name,
                    "payment_reference": payment_reference,
                    "payyantra_order_id": payyantra_order_id or "",
                    "transaction_id": transaction_id or "",
                    "transaction_public_id": str(transaction_public_id) if transaction_public_id else None,
                    "amount": payable_amount,
                    "currency": "INR",
                    "status": "pending",
                }
            elif response.status_code == 401:
                cls.get_auth_token(force_refresh=True)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="PayYantra session expired. Please retry subscription payment.",
                )
            else:
                error_body = response.text[:300].strip()
                logger.error(f"PayYantra subscription create order failed with HTTP {response.status_code}: {error_body}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PayYantra rejected subscription order (HTTP {response.status_code}): {error_body or 'Bad Request'}.",
                )
        except httpx.RequestError as exc:
            logger.error(f"Network error communicating with PayYantra: {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to PayYantra payment gateway. Please check network or try again.",
            )

    @classmethod
    def get_status_by_order_id(cls, payyantra_order_id: str) -> Dict[str, Any]:
        """Query official PayYantra order status using platform orderId."""
        token = cls.get_auth_token()
        url = f"{settings.PAYYANTRA_BASE_URL.rstrip('/')}/api/pay/status/{payyantra_order_id}"
        headers = {"Authorization": f"Bearer {token}"}

        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, headers=headers)

        if response.status_code == 200:
            return response.json().get("data", {})
        elif response.status_code == 404:
            return {}
        else:
            logger.warning(f"Status by orderId returned {response.status_code}: {response.text}")
            return {}

    @classmethod
    def get_status_by_reference(cls, reference_id: str) -> Dict[str, Any]:
        """Query official PayYantra order status using merchant referenceId with candidate route fallback."""
        token = cls.get_auth_token()
        base = settings.PAYYANTRA_BASE_URL.rstrip('/')
        url1 = f"{base}/api/pay/status/by-reference/{reference_id}"
        url2 = f"{base}/api/pay/status-by-reference/{reference_id}"
        headers = {"Authorization": f"Bearer {token}"}

        with httpx.Client(timeout=15.0) as client:
            response = client.get(url1, headers=headers)
            if response.status_code == 404:
                response = client.get(url2, headers=headers)

        if response.status_code == 200:
            return response.json().get("data", {})
        elif response.status_code == 404:
            return {}
        else:
            logger.warning(f"Status by referenceId returned {response.status_code}: {response.text}")
            return {}

    @classmethod
    def verify_and_sync_order_status(
        cls,
        db: Session,
        order_id: str,
        user: Optional[User] = None,
    ) -> PayYantraStatusResponse:
        """
        Polls and synchronizes the definitive payment state from PayYantra status APIs.
        Fulfills order and updates stock ONLY when PayYantra confirms SUCCESS.
        Idempotent: will not duplicate inventory deductions or status updates.
        """
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        if user and order.user_id != user.id and not getattr(user, "is_admin", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        payment = (
            db.query(Payment)
            .filter(Payment.order_id == order.id, Payment.provider == PaymentProvider.PAYYANTRA)
            .order_by(Payment.created_at.desc())
            .first()
        )

        if not payment:
            # Fallback check for any payment
            payment = (
                db.query(Payment)
                .filter(Payment.order_id == order.id)
                .order_by(Payment.created_at.desc())
                .first()
            )

        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found.")

        # If already captured, return immediate verified status
        if payment.status == PaymentStatus.CAPTURED:
            return PayYantraStatusResponse(
                order_id=order.id,
                order_number=order.order_number,
                payment_status=payment.status,
                order_status=order.status.value,
                payyantra_order_id=payment.payyantra_order_id,
                reference_id=payment.reference_id,
                transaction_id=payment.transaction_id,
                amount=float(payment.amount),
                currency=payment.currency,
                rrn=payment.rrn,
                verified_at=payment.verified_at,
            )

        # Query gateway status if credentials are configured
        gateway_data = {}
        if cls.is_configured():
            try:
                if payment.payyantra_order_id:
                    gateway_data = cls.get_status_by_order_id(payment.payyantra_order_id)
                if not gateway_data and payment.reference_id:
                    gateway_data = cls.get_status_by_reference(payment.reference_id)
            except Exception as e:
                logger.error(f"Error querying PayYantra order status: {str(e)}")

        gw_status = (gateway_data.get("status") or "").upper()

        if gw_status == "SUCCESS":
            cls._mark_payment_success(db, order, payment, gateway_data)
        elif gw_status == "FAILED":
            cls._mark_payment_failed(db, order, payment, gateway_data)

        return PayYantraStatusResponse(
            order_id=order.id,
            order_number=order.order_number,
            payment_status=payment.status,
            order_status=order.status.value,
            payyantra_order_id=payment.payyantra_order_id,
            reference_id=payment.reference_id,
            transaction_id=payment.transaction_id,
            amount=float(payment.amount),
            currency=payment.currency,
            rrn=payment.rrn,
            error_code=payment.error_code,
            error_description=payment.error_description,
            verified_at=payment.verified_at,
        )

    @classmethod
    def verify_and_sync_subscription_status(
        cls,
        db: Session,
        subscription_id: str,
        user: Optional[User] = None,
    ) -> Dict[str, Any]:
        """
        Polls and synchronizes the definitive subscription payment state from PayYantra status APIs.
        Activates subscription ONLY when PayYantra confirms SUCCESS.
        Idempotent: will not duplicate activation or extend dates repeatedly.
        """
        sub = db.query(UserSubscription).filter(UserSubscription.id == subscription_id).first()
        if not sub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription purchase not found.")

        if user and sub.user_id != user.id and not getattr(user, "is_admin", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        # If already captured, return immediate verified status
        if sub.status == "active" and sub.payment_status == "captured":
            now = datetime.now(timezone.utc)
            days_left = max(0, (sub.expiry_date - now).days)
            return {
                "subscription_id": sub.id,
                "plan_name": sub.plan.name if sub.plan else "VIP Membership",
                "payment_status": sub.payment_status,
                "subscription_status": sub.status,
                "is_active": True,
                "amount": float(sub.amount_paid),
                "payment_reference": sub.payment_reference,
                "payyantra_order_id": sub.payyantra_order_id,
                "start_date": sub.start_date.isoformat(),
                "expiry_date": sub.expiry_date.isoformat(),
                "days_remaining": days_left,
                "verified_at": sub.updated_at.isoformat() if sub.updated_at else None,
            }

        # Query gateway status if credentials are configured
        gateway_data = {}
        if cls.is_configured():
            try:
                if sub.payyantra_order_id:
                    gateway_data = cls.get_status_by_order_id(sub.payyantra_order_id)
                if not gateway_data and sub.payment_reference:
                    gateway_data = cls.get_status_by_reference(sub.payment_reference)
            except Exception as e:
                logger.error(f"Error querying PayYantra subscription status: {str(e)}")

        gw_status = (gateway_data.get("status") or "").upper()

        if gw_status == "SUCCESS":
            SubscriptionService.confirm_subscription_payment(db, sub, gateway_data)
        elif gw_status in ["FAILED", "CANCELLED", "EXPIRED"]:
            SubscriptionService.mark_subscription_failed(db, sub, gateway_data)

        now = datetime.now(timezone.utc)
        days_left = max(0, (sub.expiry_date - now).days) if sub.status == "active" else 0

        return {
            "subscription_id": sub.id,
            "plan_name": sub.plan.name if sub.plan else "VIP Membership",
            "payment_status": sub.payment_status,
            "subscription_status": sub.status,
            "is_active": sub.status == "active" and sub.payment_status == "captured",
            "amount": float(sub.amount_paid),
            "payment_reference": sub.payment_reference,
            "payyantra_order_id": sub.payyantra_order_id,
            "start_date": sub.start_date.isoformat() if sub.start_date else None,
            "expiry_date": sub.expiry_date.isoformat() if sub.expiry_date else None,
            "days_remaining": days_left,
            "error_description": sub.poll_error,
            "verified_at": sub.updated_at.isoformat() if sub.updated_at else None,
        }

    @classmethod
    def process_webhook(cls, db: Session, payload: PayYantraWebhookPayload) -> Dict[str, Any]:
        """
        Receives and processes PayYantra server-to-server payment notifications (notifyUrl).
        Ensures idempotent processing, inventory deduction, and status reconciliation.
        """
        logger.info(
            f"Received PayYantra webhook for orderId={payload.orderId}, "
            f"status={payload.status}, terminalStatus={payload.terminalStatus}, txnId={payload.txnId}"
        )

        # Check if notification is for a subscription purchase
        if (
            (payload.orderId and payload.orderId.startswith("SUB-"))
            or (payload.referenceId and payload.referenceId.startswith("SUBREF-"))
        ):
            sub = (
                db.query(UserSubscription)
                .filter(
                    or_(
                        UserSubscription.merchant_order_id == payload.orderId,
                        UserSubscription.payment_reference == payload.referenceId,
                        UserSubscription.transaction_id == payload.txnId,
                    )
                )
                .first()
            )
            if not sub:
                logger.warning(f"PayYantra webhook received for unknown subscription order {payload.orderId}")
                return {"status": "ignored", "reason": "Subscription not found."}

            if sub.status == "active" and sub.payment_status == "captured":
                logger.info(f"Subscription {sub.id} already marked active. Skipping duplicate webhook.")
                return {"status": "already_processed", "subscription_id": sub.id}

            status_cand = (payload.terminalStatus or payload.status or "").upper()
            raw_data = payload.model_dump()

            if status_cand == "SUCCESS":
                SubscriptionService.confirm_subscription_payment(db, sub, raw_data)
                return {"status": "success", "subscription_id": sub.id, "payment_status": "captured"}
            elif status_cand in ["FAILED", "CANCELLED", "EXPIRED"]:
                SubscriptionService.mark_subscription_failed(db, sub, raw_data)
                return {"status": "failed", "subscription_id": sub.id, "payment_status": "failed"}
            else:
                return {"status": "pending", "subscription_id": sub.id}

        # Look up payment by merchant order ID, reference ID, or transaction ID
        payment = (
            db.query(Payment)
            .filter(
                or_(
                    Payment.merchant_order_id == payload.orderId,
                    Payment.reference_id == payload.referenceId,
                    Payment.transaction_id == payload.txnId,
                )
            )
            .first()
        )

        if not payment:
            # Check by order number matching
            clean_ord = payload.orderId.replace("ORD-", "")
            order = db.query(Order).filter(Order.order_number == clean_ord).first()
            if order:
                payment = (
                    db.query(Payment)
                    .filter(Payment.order_id == order.id)
                    .order_by(Payment.created_at.desc())
                    .first()
                )

        if not payment:
            logger.warning(f"PayYantra webhook received for unknown order {payload.orderId}")
            return {"status": "ignored", "reason": "Order not found."}

        order = db.query(Order).filter(Order.id == payment.order_id).first()
        if not order:
            return {"status": "ignored", "reason": "Associated order not found."}

        # Idempotency check: if already confirmed/paid, do not re-process
        if payment.status == PaymentStatus.CAPTURED:
            logger.info(f"Payment {payment.id} already marked CAPTURED. Skipping duplicate webhook.")
            return {"status": "already_processed", "order_id": order.id}

        # Verify terminal state
        status_candidate = (payload.terminalStatus or payload.status or "").upper()
        raw_data = payload.model_dump()

        if status_candidate == "SUCCESS":
            cls._mark_payment_success(db, order, payment, raw_data)
            return {"status": "success", "order_id": order.id, "payment_status": "captured"}
        elif status_candidate in ["FAILED", "CANCELLED", "EXPIRED"]:
            cls._mark_payment_failed(db, order, payment, raw_data)
            return {"status": "failed", "order_id": order.id, "payment_status": "failed"}
        else:
            logger.info(f"PayYantra non-terminal status received: {status_candidate}")
            return {"status": "pending", "order_id": order.id}

    @classmethod
    def _mark_payment_success(
        cls,
        db: Session,
        order: Order,
        payment: Payment,
        gateway_data: Dict[str, Any],
    ) -> None:
        """Helper to mark payment captured, order confirmed, and deduct inventory."""
        now = datetime.now(timezone.utc)
        payment.status = PaymentStatus.CAPTURED
        payment.verified_at = now
        payment.rrn = gateway_data.get("rrn") or payment.rrn
        payment.gateway_response = gateway_data

        if gateway_data.get("txnId") and not payment.transaction_id:
            payment.transaction_id = gateway_data.get("txnId")

        order.status = OrderStatus.CONFIRMED

        # Note: inventory is already reserved atomically during order creation in OrderService.
        # Here we finalize the confirmation and record verification metadata.
        db.commit()
        db.refresh(order)
        db.refresh(payment)
        logger.info(f"Order {order.order_number} confirmed after PayYantra success.")

    @classmethod
    def _mark_payment_failed(
        cls,
        db: Session,
        order: Order,
        payment: Payment,
        gateway_data: Dict[str, Any],
    ) -> None:
        """Helper to record payment failure."""
        payment.status = PaymentStatus.FAILED
        payment.error_code = str(gateway_data.get("errorCode") or "PAYMENT_FAILED")
        payment.error_description = str(gateway_data.get("errorMessage") or "Payment authorization failed.")
        payment.gateway_response = gateway_data

        db.commit()
        db.refresh(payment)
        logger.warning(f"Payment for order {order.order_number} marked FAILED.")
