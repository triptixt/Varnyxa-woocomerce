import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.subscription import SubscriptionPlan, UserSubscription
from app.models.user import User

DEFAULT_PLANS = [
    {
        "name": "Monthly Membership",
        "slug": "monthly",
        "billing_cycle": "monthly",
        "duration_days": 30,
        "price": 149.00,
        "description": "Flexible month-to-month access to complimentary delivery and member privileges.",
        "benefits": [
            "Complimentary Express Delivery on every order (No minimum ₹1,499 cart required)",
            "Exclusive Member-Only promotional pricing",
            "Early 24-hour access to seasonal runway drops",
        ],
    },
    {
        "name": "Quarterly Membership",
        "slug": "quarterly",
        "billing_cycle": "quarterly",
        "duration_days": 90,
        "price": 399.00,
        "description": "Seasonal 3-month membership providing superior savings and express benefits.",
        "benefits": [
            "Complimentary Express Delivery on every order (Zero shipping fee)",
            "Exclusive Member-Only promotional pricing & styling previews",
            "Early 24-hour access to seasonal runway drops",
            "Priority doorstep alterations & hassle-free exchanges",
        ],
    },
    {
        "name": "Annual Membership",
        "slug": "annual",
        "billing_cycle": "annual",
        "duration_days": 365,
        "price": 1199.00,
        "description": "Full-year haute couture membership offering maximum privileges and curated couture access.",
        "benefits": [
            "Complimentary Express Delivery on every order all year round",
            "Exclusive Member-Only promotional pricing across all collections",
            "VIP priority access to bridal & bespoke couture consultations",
            "Complimentary packaging & gift concierge dispatch",
        ],
    },
]


class SubscriptionService:
    @staticmethod
    def initialize_plans(db: Session) -> None:
        """Seed default subscription plans if table is empty."""
        for p in DEFAULT_PLANS:
            existing = db.query(SubscriptionPlan).filter(SubscriptionPlan.slug == p["slug"]).first()
            if not existing:
                plan = SubscriptionPlan(
                    name=p["name"],
                    slug=p["slug"],
                    billing_cycle=p["billing_cycle"],
                    duration_days=p["duration_days"],
                    price=p["price"],
                    description=p["description"],
                    benefits=p["benefits"],
                    is_active=True,
                )
                db.add(plan)
        db.commit()

    @staticmethod
    def get_active_plans(db: Session) -> List[SubscriptionPlan]:
        SubscriptionService.initialize_plans(db)
        return (
            db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.price.asc())
            .all()
        )

    @staticmethod
    def get_plan_by_id(db: Session, plan_id: str) -> SubscriptionPlan:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription plan not found.")
        return plan

    @staticmethod
    def get_user_active_subscription(db: Session, user_id: str) -> Optional[UserSubscription]:
        """Returns the user's current valid subscription if active and unexpired."""
        now = datetime.now(timezone.utc)
        sub = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "active",
                UserSubscription.payment_status.in_(["captured", "active"]),
                UserSubscription.expiry_date > now,
            )
            .order_by(UserSubscription.expiry_date.desc())
            .first()
        )
        return sub

    @staticmethod
    def is_user_premium_member(db: Session, user_id: Optional[str]) -> bool:
        if not user_id:
            return False
        sub = SubscriptionService.get_user_active_subscription(db, user_id)
        return sub is not None

    @staticmethod
    def create_pending_subscription(
        db: Session,
        user: User,
        plan_id: str,
        payment_reference: str,
        merchant_order_id: str,
        amount: float,
    ) -> UserSubscription:
        """Creates a pending subscription purchase before payment checkout."""
        plan = SubscriptionService.get_plan_by_id(db, plan_id)
        now = datetime.now(timezone.utc)
        tentative_expiry = now + timedelta(days=plan.duration_days)

        sub = UserSubscription(
            user_id=user.id,
            plan_id=plan.id,
            status="pending",
            payment_status="pending",
            start_date=now,
            expiry_date=tentative_expiry,
            amount_paid=amount,
            payment_reference=payment_reference,
            merchant_order_id=merchant_order_id,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def confirm_subscription_payment(
        db: Session,
        sub: UserSubscription,
        gateway_data: Dict[str, Any],
    ) -> UserSubscription:
        """Idempotently activates subscription only after verified payment success."""
        if sub.status == "active" and sub.payment_status == "captured":
            return sub

        now = datetime.now(timezone.utc)
        plan = sub.plan or SubscriptionService.get_plan_by_id(db, sub.plan_id)

        # Check existing active subscription to extend expiry
        existing_sub = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == sub.user_id,
                UserSubscription.status == "active",
                UserSubscription.id != sub.id,
                UserSubscription.expiry_date > now,
            )
            .order_by(UserSubscription.expiry_date.desc())
            .first()
        )

        if existing_sub and existing_sub.expiry_date > now:
            start_date = existing_sub.expiry_date
            expiry_date = start_date + timedelta(days=plan.duration_days)
        else:
            start_date = now
            expiry_date = now + timedelta(days=plan.duration_days)

        sub.status = "active"
        sub.payment_status = "captured"
        sub.start_date = start_date
        sub.expiry_date = expiry_date
        sub.gateway_response = gateway_data
        sub.transaction_id = gateway_data.get("txnId") or gateway_data.get("transactionId") or sub.transaction_id
        sub.last_polled_at = now
        sub.updated_at = now

        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def mark_subscription_failed(
        db: Session,
        sub: UserSubscription,
        gateway_data: Dict[str, Any],
    ) -> UserSubscription:
        """Records payment failure and marks subscription cancelled."""
        sub.status = "cancelled"
        sub.payment_status = "failed"
        sub.gateway_response = gateway_data
        sub.poll_error = str(gateway_data.get("errorMessage") or gateway_data.get("errorCode") or "Payment authorization failed")
        sub.last_polled_at = datetime.now(timezone.utc)
        sub.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def activate_subscription(
        db: Session,
        user: User,
        plan_id: str,
        payment_reference: str,
        amount_paid: Optional[float] = None,
    ) -> UserSubscription:
        """Direct activation helper (used in tests or manual administrative grants)."""
        plan = SubscriptionService.get_plan_by_id(db, plan_id)
        now = datetime.now(timezone.utc)

        existing_sub = SubscriptionService.get_user_active_subscription(db, user.id)
        if existing_sub and existing_sub.expiry_date > now:
            start_date = existing_sub.expiry_date
            expiry_date = start_date + timedelta(days=plan.duration_days)
            existing_sub.expiry_date = expiry_date
            existing_sub.plan_id = plan.id
            existing_sub.amount_paid = float(plan.price) if amount_paid is None else amount_paid
            existing_sub.payment_reference = payment_reference
            existing_sub.payment_status = "captured"
            existing_sub.status = "active"
            existing_sub.updated_at = now
            db.commit()
            db.refresh(existing_sub)
            return existing_sub
        else:
            start_date = now
            expiry_date = now + timedelta(days=plan.duration_days)

            new_sub = UserSubscription(
                user_id=user.id,
                plan_id=plan.id,
                status="active",
                payment_status="captured",
                start_date=start_date,
                expiry_date=expiry_date,
                amount_paid=float(plan.price) if amount_paid is None else amount_paid,
                payment_reference=payment_reference,
            )
            db.add(new_sub)
            db.commit()
            db.refresh(new_sub)
            return new_sub

    # Admin CRUD for plans
    @staticmethod
    def update_plan(db: Session, plan_id: str, updates: Dict[str, Any]) -> SubscriptionPlan:
        plan = SubscriptionService.get_plan_by_id(db, plan_id)
        for k, v in updates.items():
            if v is not None and hasattr(plan, k):
                setattr(plan, k, v)
        plan.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(plan)
        return plan
