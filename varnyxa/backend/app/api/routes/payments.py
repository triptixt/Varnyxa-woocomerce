from typing import Optional
from fastapi import APIRouter, Depends, Request, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.payment import (
    RazorpayOrderCreateRequest,
    RazorpayOrderResponse,
    RazorpayVerifyRequest,
    PayYantraCheckoutRequest,
    PayYantraCheckoutResponse,
    PayYantraStatusResponse,
    PayYantraWebhookPayload,
    DemoPaymentCompleteRequest,
)
from app.schemas.order import OrderResponse
from app.services.payment_service import PaymentService
from app.services.payyantra_service import PayYantraService
from app.services.settings_service import SettingsService
from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/config")
def get_payment_config(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Returns available payment gateway configurations for checkout.
    Cash on Delivery (COD) is strictly admin-only and never exposed to customers.
    """
    payyantra_ok = PayYantraService.is_configured()
    razorpay_ok = PaymentService.is_razorpay_configured()

    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)
    admin_allow_cod = (
        SettingsService.get_setting(db, "admin_allow_cod", "true").lower() in ("true", "1", "yes")
        if is_admin
        else False
    )

    # Determine active provider (respects explicit admin preference in DB, or configured keys)
    from app.models.settings import StoreSetting
    explicit_pref = db.query(StoreSetting).filter(StoreSetting.key == "active_payment_gateway").first()
    if explicit_pref and explicit_pref.value.lower() in ("razorpay", "payyantra"):
        active_provider = explicit_pref.value.lower()
    elif razorpay_ok:
        active_provider = "razorpay"
    elif payyantra_ok:
        active_provider = "payyantra"
    else:
        active_provider = "razorpay"

    return {
        "payyantra_configured": payyantra_ok,
        "razorpay_configured": razorpay_ok,
        "active_provider": active_provider,
        "admin_cod_available": is_admin and admin_allow_cod,
        "currency": settings.STORE_CURRENCY,
        "currency_symbol": settings.STORE_CURRENCY_SYMBOL,
    }

@router.get("/payyantra/diagnostics")
def get_payyantra_diagnostics():
    """
    Returns safe, non-sensitive diagnostic information about the PayYantra integration.
    Never exposes raw secrets or tokens.
    """
    return PayYantraService.get_diagnostics()


@router.get("/razorpay/diagnostics")
def get_razorpay_diagnostics():
    """
    Returns safe, non-sensitive diagnostic information about the Razorpay integration.
    Never exposes raw secrets or keys.
    """
    return PaymentService.get_diagnostics()


# ==========================================
# PayYantra Hosted Checkout V3 Endpoints
# ==========================================

@router.post("/payyantra/checkout", response_model=PayYantraCheckoutResponse)
def create_payyantra_checkout(
    data: PayYantraCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a PayYantra Hosted Checkout V3 order.
    Returns the official checkoutUrl to which the browser must redirect directly.
    """
    if current_user.role != UserRole.ADMIN and data.payment_method and data.payment_method.upper().strip() in ["HOSTED", "GENERIC"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Generic PayYantra Hosted Checkout is restricted to administrators. Please select a specific payment method (UPI, CARD, or NETBANKING).",
        )

    return PayYantraService.create_hosted_checkout_order(
        db=db,
        order_id=data.order_id,
        user=current_user,
        payment_method=data.payment_method,
        custom_return_url=data.return_url,
    )


@router.get("/payyantra/status/{order_id}", response_model=PayYantraStatusResponse)
def get_payyantra_order_status(
    order_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Synchronizes and returns definitive payment status from PayYantra status APIs.
    Used by payment callback and order reconciliation pages.
    """
    return PayYantraService.verify_and_sync_order_status(
        db=db,
        order_id=order_id,
        user=current_user,
    )


@router.post("/payyantra/webhook")
def payyantra_webhook(
    payload: PayYantraWebhookPayload,
    db: Session = Depends(get_db),
):
    """
    Receives and processes PayYantra server-to-server payment notifications (notifyUrl).
    Fulfills orders idempotently upon terminal SUCCESS status.
    """
    return PayYantraService.process_webhook(db=db, payload=payload)


# ==========================================
# Razorpay & Cash on Delivery Endpoints
# ==========================================

@router.post("/razorpay/create-order", response_model=RazorpayOrderResponse)
def create_razorpay_order(
    data: RazorpayOrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return PaymentService.create_razorpay_order(
        db,
        order_id=data.order_id,
        user=current_user,
        payment_method=data.payment_method,
    )


@router.get("/razorpay/status/{order_id}")
def get_razorpay_order_status(
    order_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Synchronizes and returns definitive payment status for a Razorpay order.
    Used by QR payment polling and instant reconciliation.
    """
    return PaymentService.get_order_payment_status(db=db, order_id=order_id, user=current_user)


@router.post("/razorpay/verify")
def verify_razorpay_payment(
    data: RazorpayVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = PaymentService.verify_payment(db, data, current_user)
    return {"verified": success, "message": "Payment verified and order confirmed successfully."}


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(..., alias="X-Razorpay-Signature"),
    db: Session = Depends(get_db),
):
    body = await request.body()
    return PaymentService.process_webhook(db, body, x_razorpay_signature)


@router.post("/demo/complete", response_model=OrderResponse)
def complete_demo_payment(
    data: DemoPaymentCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Persists an explicitly requested demo payment transaction in the PostgreSQL database.
    Distinctly records PaymentProvider.DEMO and PaymentStatus.DEMO_COMPLETED.
    Ensures demo transactions never mark real Razorpay or PayYantra payments as captured.
    Updates order status to CONFIRMED.
    """
    return PaymentService.complete_demo_payment(
        db=db,
        order_id=data.order_id,
        user=current_user,
        payment_method=data.payment_method,
        reference_id=data.reference_id,
    )


@router.get("/status/{order_id}")
def get_unified_payment_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns or reconciles the authoritative payment status for an order across all supported providers
    (Razorpay, PayYantra, or Demo). Used by My Orders and checkout confirmation.
    """
    from app.models.order import Order, Payment, PaymentProvider, PaymentStatus
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    if order.user_id != current_user.id and getattr(current_user, "role", None) != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    payment = db.query(Payment).filter(Payment.order_id == order.id).order_by(Payment.created_at.desc()).first()
    if not payment:
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": "pending",
            "order_status": order.status.value,
            "provider": None,
        }

    # If demo completed, return instantly
    if payment.status == PaymentStatus.DEMO_COMPLETED or payment.provider == PaymentProvider.DEMO:
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": payment.status.value,
            "order_status": order.status.value,
            "provider": payment.provider.value,
            "reference_id": payment.reference_id,
            "verified_at": payment.verified_at,
            "is_paid": True,
            "is_demo": True,
        }

    # If already captured, return instantly
    if payment.status == PaymentStatus.CAPTURED:
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": payment.status.value,
            "order_status": order.status.value,
            "provider": payment.provider.value,
            "reference_id": payment.reference_id,
            "verified_at": payment.verified_at,
            "is_paid": True,
            "is_demo": False,
        }

    # If PayYantra, sync with PayYantra status API
    if payment.provider == PaymentProvider.PAYYANTRA:
        sync_res = PayYantraService.verify_and_sync_order_status(db, order_id=order.id, user=current_user)
        is_cap = sync_res.payment_status in (PaymentStatus.CAPTURED, "captured")
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": sync_res.payment_status.value if hasattr(sync_res.payment_status, "value") else str(sync_res.payment_status),
            "order_status": sync_res.order_status,
            "provider": payment.provider.value,
            "reference_id": sync_res.reference_id,
            "verified_at": sync_res.verified_at,
            "is_paid": is_cap,
            "is_demo": False,
        }

    # If Razorpay, sync with Razorpay status
    if payment.provider == PaymentProvider.RAZORPAY:
        sync_res = PaymentService.get_order_payment_status(db, order_id=order.id, user=current_user)
        p_status = sync_res.get("payment_status")
        is_cap = p_status in (PaymentStatus.CAPTURED, "captured")
        return {
            **sync_res,
            "is_paid": is_cap,
            "is_demo": False,
        }

    is_paid = payment.status == PaymentStatus.CAPTURED
    is_demo = payment.status == PaymentStatus.DEMO_COMPLETED or payment.provider == PaymentProvider.DEMO
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "payment_status": payment.status.value,
        "order_status": order.status.value,
        "provider": payment.provider.value,
        "reference_id": payment.reference_id,
        "verified_at": payment.verified_at,
        "is_paid": is_paid or is_demo,
        "is_demo": is_demo,
    }

