import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User
from app.models.subscription import UserSubscription, SubscriptionPlan
from app.services.subscription_service import SubscriptionService
from app.services.payyantra_service import PayYantraService

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions & Premium Membership"])


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    duration_days: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None
    benefits: Optional[List[str]] = None
    is_active: Optional[bool] = None


class SubscribeRequest(BaseModel):
    plan_id: str
    direct_activate: Optional[bool] = False


@router.get("/plans")
def get_subscription_plans(db: Session = Depends(get_db)):
    """Publicly retrieve available premium membership subscription plans."""
    plans = SubscriptionService.get_active_plans(db)
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "code": p.slug,
            "billing_cycle": p.billing_cycle,
            "duration_days": p.duration_days,
            "price": float(p.price),
            "description": p.description,
            "benefits": p.benefits,
            "is_active": p.is_active,
        }
        for p in plans
    ]


@router.get("/me")
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the authenticated customer's current subscription status."""
    active_sub = SubscriptionService.get_user_active_subscription(db, current_user.id)
    sub = active_sub
    if not sub:
        sub = (
            db.query(UserSubscription)
            .filter(UserSubscription.user_id == current_user.id)
            .order_by(UserSubscription.created_at.desc())
            .first()
        )

    if not sub:
        return {
            "has_active_subscription": False,
            "subscription": None,
        }

    now = datetime.now(timezone.utc)
    is_active = (
        sub.status == "active"
        and sub.payment_status in ("captured", "active")
        and sub.expiry_date > now
    )
    days_remaining = max(0, (sub.expiry_date - now).days) if sub.expiry_date else 0

    return {
        "has_active_subscription": is_active,
        "subscription": {
            "id": sub.id,
            "plan_id": sub.plan_id,
            "plan_name": sub.plan.name if sub.plan else "Privé Membership",
            "plan_code": sub.plan.slug if sub.plan else "prive",
            "billing_cycle": sub.plan.billing_cycle if sub.plan else "monthly",
            "status": sub.status,
            "payment_status": sub.payment_status or "pending",
            "is_active": is_active,
            "start_date": sub.start_date.isoformat() if sub.start_date else None,
            "expiry_date": sub.expiry_date.isoformat() if sub.expiry_date else None,
            "days_remaining": days_remaining,
            "amount_paid": float(sub.amount_paid or 0),
            "payment_reference": sub.payment_reference,
            "payyantra_order_id": sub.payyantra_order_id,
            "benefits": sub.plan.benefits if sub.plan and sub.plan.benefits else [
                "Unlimited Free Express Delivery",
                "Bespoke Styling Consultations",
                "Priority Atelier Tailoring & Dispatch",
                "Exclusive VIP Access to Haute Drops",
            ],
        },
    }


@router.post("/subscribe")
def subscribe_to_plan(
    data: SubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Subscribes the authenticated customer to a membership plan.
    Initiates payment checkout via PayYantra Hosted Checkout V3.
    """
    plan = SubscriptionService.get_plan_by_id(db, data.plan_id)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected plan is inactive.")

    # If direct_activate is requested (tests or admin grant)
    if data.direct_activate:
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        rand_suffix = uuid.uuid4().hex[:8].upper()
        payment_ref = f"SUBREF-{now_str}-{rand_suffix}"

        sub = SubscriptionService.activate_subscription(
            db=db,
            user=current_user,
            plan_id=plan.id,
            payment_reference=payment_ref,
            amount_paid=float(plan.price),
        )
        now = datetime.now(timezone.utc)
        days_remaining = max(0, (sub.expiry_date - now).days)

        return {
            "success": True,
            "message": f"Successfully activated {plan.name}!",
            "subscription_id": sub.id,
            "payment_reference": payment_ref,
            "subscription": {
                "id": sub.id,
                "plan_id": plan.id,
                "plan_name": plan.name,
                "plan_code": plan.slug,
                "billing_cycle": plan.billing_cycle,
                "status": sub.status,
                "is_active": sub.status == "active",
                "expiry_date": sub.expiry_date.isoformat(),
                "days_remaining": days_remaining,
                "payment_reference": payment_ref,
                "amount_paid": float(sub.amount_paid),
            },
        }

    # Standard customer payment flow via PayYantra Hosted Checkout
    checkout_data = PayYantraService.create_subscription_checkout_order(
        db=db,
        user=current_user,
        plan_id=plan.id,
    )

    return {
        "success": True,
        "message": f"Redirecting to PayYantra Hosted Checkout for {plan.name}...",
        "checkout_url": checkout_data["checkout_url"],
        "subscription_id": checkout_data["subscription_id"],
        "payment_reference": checkout_data["payment_reference"],
        "payyantra_order_id": checkout_data["payyantra_order_id"],
        "amount": checkout_data["amount"],
        "status": "pending",
    }


@router.get("/status/{subscription_id}")
def get_subscription_status(
    subscription_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Checks and synchronizes subscription payment state with PayYantra status APIs.
    Used by payment callback and subscription success verification.
    """
    return PayYantraService.verify_and_sync_subscription_status(
        db=db,
        subscription_id=subscription_id,
        user=current_user,
    )


@router.get("/admin/all")
def admin_get_all_subscriptions(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin endpoint to view all pending, active, and expired subscriptions."""
    subs = db.query(UserSubscription).order_by(UserSubscription.created_at.desc()).all()
    now = datetime.now(timezone.utc)
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "user_name": s.user.full_name if s.user else "Unknown",
            "user_email": s.user.email if s.user else "Unknown",
            "plan_name": s.plan.name if s.plan else "VIP Plan",
            "status": s.status,
            "payment_status": s.payment_status,
            "amount_paid": float(s.amount_paid),
            "payment_reference": s.payment_reference,
            "payyantra_order_id": s.payyantra_order_id,
            "start_date": s.start_date.isoformat(),
            "expiry_date": s.expiry_date.isoformat(),
            "days_remaining": max(0, (s.expiry_date - now).days) if s.status == "active" else 0,
            "poll_count": s.poll_count,
            "poll_error": s.poll_error,
            "last_polled_at": s.last_polled_at.isoformat() if s.last_polled_at else None,
            "created_at": s.created_at.isoformat(),
        }
        for s in subs
    ]


@router.post("/admin/refresh/{subscription_id}")
def admin_refresh_subscription_status(
    subscription_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin manual action to verify and sync subscription status with PayYantra."""
    return PayYantraService.verify_and_sync_subscription_status(
        db=db,
        subscription_id=subscription_id,
        user=current_admin,
    )


# Admin Plan Management
@router.get("/admin/plans")
def admin_get_all_plans(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin view of all subscription plans."""
    SubscriptionService.initialize_plans(db)
    from app.models.subscription import SubscriptionPlan
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price.asc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "billing_cycle": p.billing_cycle,
            "duration_days": p.duration_days,
            "price": float(p.price),
            "description": p.description,
            "benefits": p.benefits,
            "is_active": p.is_active,
        }
        for p in plans
    ]


@router.put("/admin/plans/{plan_id}")
def admin_update_plan(
    plan_id: str,
    data: SubscriptionPlanUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin update of subscription plan pricing, duration, and benefits."""
    updates = data.model_dump(exclude_unset=True)
    plan = SubscriptionService.update_plan(db, plan_id, updates)
    return {
        "id": plan.id,
        "name": plan.name,
        "price": float(plan.price),
        "duration_days": plan.duration_days,
        "description": plan.description,
        "benefits": plan.benefits,
        "is_active": plan.is_active,
    }
