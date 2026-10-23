from typing import Optional, List
from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    variant_id: str
    quantity: int = Field(default=1, ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1)


class CartItemDetail(BaseModel):
    id: str
    variant_id: str
    product_id: str
    product_title: str
    product_slug: str
    size: str
    color_name: str
    color_hex: str
    sku: str
    unit_price: float
    quantity: int
    total_price: float
    stock_quantity: int
    image_url: Optional[str] = None


class CartResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    session_token: Optional[str] = None
    items: List[CartItemDetail]
    item_count: int
    subtotal: float
    discount_amount: float = 0.0
    coupon_code: Optional[str] = None
    shipping_fee: float = 0.0
    shipping_threshold: float = 1499.0
    is_free_shipping: bool = False
    tax_amount: float = 0.0
    tax_rate: float = 18.0
    admin_discount_percent: float = 0.0
    total_amount: float


class MergeCartRequest(BaseModel):
    session_token: str
