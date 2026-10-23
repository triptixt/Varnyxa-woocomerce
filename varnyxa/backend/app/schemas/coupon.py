from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.coupon import DiscountType


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    description: str = Field(..., min_length=3, max_length=255)
    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: float = Field(..., gt=0)
    min_order_value: float = Field(default=0.0, ge=0)
    max_discount: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    usage_limit: Optional[int] = None
    is_active: bool = True


class CouponUpdate(BaseModel):
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    min_order_value: Optional[float] = None
    max_discount: Optional[float] = None
    valid_to: Optional[datetime] = None
    usage_limit: Optional[int] = None
    is_active: Optional[bool] = None


class CouponResponse(BaseModel):
    id: str
    code: str
    description: str
    discount_type: DiscountType
    discount_value: float
    min_order_value: float
    max_discount: Optional[float]
    valid_from: datetime
    valid_to: Optional[datetime]
    usage_limit: Optional[int]
    times_used: int
    is_active: bool

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float = Field(..., ge=0)


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_amount: float
    discount_type: DiscountType
    discount_value: float
    message: str
