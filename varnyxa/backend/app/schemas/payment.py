from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.order import PaymentProvider, PaymentStatus


class RazorpayOrderCreateRequest(BaseModel):
    order_id: str
    payment_method: Optional[str] = None  # "upi", "card", "netbanking"


class RazorpayOrderResponse(BaseModel):
    razorpay_order_id: str
    amount: int  # In paise
    currency: str
    key_id: str
    order_number: str
    customer_name: str
    customer_email: str
    customer_phone: Optional[str] = None
    payment_method: Optional[str] = None
    qr_id: Optional[str] = None
    qr_image_url: Optional[str] = None
    qr_data: Optional[str] = None


class RazorpayVerifyRequest(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RazorpayStatusResponse(BaseModel):
    order_id: str
    order_number: str
    payment_status: PaymentStatus
    order_status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "INR"
    verified_at: Optional[datetime] = None


class PaymentResponse(BaseModel):
    id: str
    order_id: str
    provider: PaymentProvider
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    payyantra_order_id: Optional[str] = None
    merchant_order_id: Optional[str] = None
    reference_id: Optional[str] = None
    transaction_id: Optional[str] = None
    transaction_public_id: Optional[str] = None
    checkout_url: Optional[str] = None
    rrn: Optional[str] = None
    payment_method: Optional[str] = None
    status: PaymentStatus
    amount: float
    currency: str
    created_at: datetime
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PayYantraCheckoutRequest(BaseModel):
    order_id: str
    payment_method: Optional[str] = None  # "UPI", "CARD", "NETBANKING", or None for ALL
    return_url: Optional[str] = None


class PayYantraCheckoutResponse(BaseModel):
    checkout_url: str
    order_id: str
    order_number: str
    payyantra_order_id: str
    transaction_id: str
    transaction_public_id: Optional[str] = None
    amount: float
    currency: str = "INR"
    payment_method: Optional[str] = None
    qr_data: Optional[str] = None
    qr_url: Optional[str] = None
    upi_intent_url: Optional[str] = None
    expires_at: Optional[str] = None


class PayYantraStatusResponse(BaseModel):
    order_id: str
    order_number: str
    payment_status: PaymentStatus
    order_status: str
    payyantra_order_id: Optional[str] = None
    reference_id: Optional[str] = None
    transaction_id: Optional[str] = None
    amount: float
    currency: str = "INR"
    rrn: Optional[str] = None
    error_code: Optional[str] = None
    error_description: Optional[str] = None
    verified_at: Optional[datetime] = None


class PayYantraWebhookPayload(BaseModel):
    orderId: str
    referenceId: Optional[str] = None
    amount: float
    currency: str = "INR"
    status: str
    terminalStatus: Optional[str] = None
    txnId: Optional[str] = None
    rrn: Optional[str] = None
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    psp_payment_information: Optional[dict] = None
    payment_details: Optional[dict] = None
    timestamp: Optional[str] = None


class PaymentConfigResponse(BaseModel):
    payyantra_configured: bool
    razorpay_configured: bool
    active_provider: str
    currency: str


class DemoPaymentCompleteRequest(BaseModel):
    order_id: str
    payment_method: Optional[str] = "UPI QR (Seamless Demo)"
    reference_id: Optional[str] = None


