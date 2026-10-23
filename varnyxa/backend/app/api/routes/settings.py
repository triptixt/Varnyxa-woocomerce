from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User
from app.services.settings_service import SettingsService

router = APIRouter(tags=["Store Settings & Business Rules"])


class SettingsUpdateRequest(BaseModel):
    gst_rate: Optional[float] = Field(None, ge=0.0, le=40.0)
    gst_mode: Optional[str] = None
    standard_shipping_fee: Optional[float] = Field(None, ge=0.0)
    free_shipping_threshold: Optional[float] = Field(None, ge=0.0)
    admin_global_discount: Optional[float] = Field(None, ge=0.0, le=70.0)
    default_theme: Optional[str] = None
    admin_allow_cod: Optional[bool] = None


class DiscountSliderRequest(BaseModel):
    discount_percent: float = Field(..., ge=0.0, le=70.0, description="Discount percentage between 0% and 70%")
    reason: Optional[str] = Field(None, max_length=255)


@router.get("/settings/public")
def get_public_settings(db: Session = Depends(get_db)):
    """Public business settings consumed by customer frontend."""
    return SettingsService.get_public_settings(db)


@router.get("/admin/settings")
def get_admin_settings(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    """Authorized admin retrieval of all store business settings."""
    return SettingsService.get_all_settings(db)


@router.put("/admin/settings")
def update_admin_settings(
    data: SettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Authorized admin modification of store business settings."""
    updates = data.model_dump(exclude_unset=True)
    return SettingsService.update_settings(db, updates, current_admin)


@router.post("/admin/discount-slider")
def update_discount_slider(
    data: DiscountSliderRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Authorized admin discount slider. Sets global store promotional discount
    and records an immutable audit log with admin credentials and timestamp.
    """
    try:
        return SettingsService.set_discount_slider(
            db, data.discount_percent, current_admin, reason=data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
