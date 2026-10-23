import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Numeric, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String(50), nullable=False)  # monthly, quarterly, annual
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)     # 30, 90, 365
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)    # 149.0, 399.0, 1199.0
    description: Mapped[str] = mapped_column(Text, nullable=False)
    benefits: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    subscriptions: Mapped[List["UserSubscription"]] = relationship(
        "UserSubscription", back_populates="plan", cascade="all, delete-orphan"
    )


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("subscription_plans.id"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default="pending", index=True, nullable=False
    )  # pending, active, expired, cancelled
    payment_status: Mapped[str] = mapped_column(
        String(50), default="pending", index=True, nullable=False
    )  # pending, captured, failed, cancelled, expired
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    payyantra_order_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    merchant_order_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    checkout_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gateway_response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    poll_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    poll_error: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")
    plan: Mapped["SubscriptionPlan"] = relationship("SubscriptionPlan", back_populates="subscriptions")
