from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.order import OrderStatus, PaymentProvider, PaymentStatus


class OrderItemResponse(BaseModel):
    id: str
    product_id: Optional[str]
    variant_id: Optional[str]
    product_title: str
    sku: str
    size: str
    color_name: str
    unit_price: float
    quantity: int
    total_price: float
    image_url: Optional[str]

    class Config:
        from_attributes = True


class PaymentSimpleResponse(BaseModel):
    id: str
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


class OrderCreateRequest(BaseModel):
    address_id: Optional[str] = None
    shipping_address: Optional[Dict[str, Any]] = None
    coupon_code: Optional[str] = None
    payment_provider: PaymentProvider = PaymentProvider.PAYYANTRA


class OrderResponse(BaseModel):
    id: str
    order_number: str
    payment_reference_id: Optional[str] = None
    user_id: str
    status: OrderStatus
    subtotal: float
    discount_amount: float
    coupon_code: Optional[str]
    shipping_fee: float
    shipping_threshold: float = 1499.0
    tax_amount: float
    tax_rate: float = 18.0
    total_amount: float
    currency: str
    shipping_address: Dict[str, Any]
    tracking_number: Optional[str]
    courier_partner: Optional[str]
    delivered_at: Optional[datetime]
    cancellation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]
    payments: List[PaymentSimpleResponse] = []

    class Config:
        from_attributes = True


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    courier_partner: Optional[str] = None


class OrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
