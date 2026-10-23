from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.coupon import Coupon, DiscountType
from app.schemas.coupon import CouponValidateRequest, CouponValidateResponse

router = APIRouter(prefix="/coupons", tags=["Coupons"])


@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(data: CouponValidateRequest, db: Session = Depends(get_db)):
    code_clean = data.code.strip().upper()
    coupon = db.query(Coupon).filter(Coupon.code == code_clean, Coupon.is_active == True).first()

    if not coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Coupon code '{code_clean}' is invalid or expired.",
        )

    now = datetime.now(timezone.utc)
    if coupon.valid_to and coupon.valid_to < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coupon code '{code_clean}' has expired.",
        )

    if coupon.usage_limit and coupon.times_used >= coupon.usage_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coupon code '{code_clean}' has reached its maximum usage limit.",
        )

    if data.subtotal < float(coupon.min_order_value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum order value of ₹{coupon.min_order_value:.2f} required for coupon '{code_clean}'.",
        )

    if coupon.discount_type == DiscountType.PERCENTAGE:
        discount = (data.subtotal * float(coupon.discount_value)) / 100.0
        if coupon.max_discount:
            discount = min(discount, float(coupon.max_discount))
    else:
        discount = min(float(coupon.discount_value), data.subtotal)

    discount = round(discount, 2)

    return CouponValidateResponse(
        valid=True,
        code=coupon.code,
        discount_amount=discount,
        discount_type=coupon.discount_type,
        discount_value=float(coupon.discount_value),
        message=f"Coupon '{coupon.code}' applied: ₹{discount:.2f} discount!",
    )
