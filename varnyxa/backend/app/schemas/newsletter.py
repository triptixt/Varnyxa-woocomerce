import math
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, model_validator


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid email address to join the VARNYXA Club")
    source: Optional[str] = Field("website_club", max_length=50, description="Acquisition channel")
    consent: Optional[bool] = Field(True, description="Explicit subscriber consent")


class NewsletterSubscribeResponse(BaseModel):
    success: bool = True
    email: str
    status: str
    message: str
    email_dispatched: bool = False
    note: Optional[str] = None
    is_new_subscriber: bool = True


class NewsletterUnsubscribeRequest(BaseModel):
    token: str = Field(..., description="Unique unsubscribe cryptographic token")
    reason: Optional[str] = Field(None, max_length=255, description="Optional cancellation feedback")


class NewsletterUnsubscribeResponse(BaseModel):
    success: bool = True
    email: str
    status: str
    message: str


class NewsletterStatusResponse(BaseModel):
    email: str
    is_subscribed: bool
    status: str
    consent_at: Optional[datetime] = None
    unsubscribed_at: Optional[datetime] = None


class NewsletterSubscriberItem(BaseModel):
    id: str
    email: str
    status: str
    consent_at: datetime
    unsubscribed_at: Optional[datetime] = None
    source: str
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NewsletterAdminListResponse(BaseModel):
    subscribers: List[NewsletterSubscriberItem] = []
    items: List[NewsletterSubscriberItem] = []
    total: int
    active_count: int
    unsubscribed_count: int
    page: int
    limit: int
    pages: int = 1

    @model_validator(mode="after")
    def populate_items_and_pages(self):
        if not self.items and self.subscribers:
            self.items = self.subscribers
        elif not self.subscribers and self.items:
            self.subscribers = self.items
        if self.limit > 0:
            self.pages = max(1, math.ceil(self.total / self.limit))
        return self
