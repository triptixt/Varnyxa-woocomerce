from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class WishlistItemResponse(BaseModel):
    id: str
    product_id: str
    product_title: str
    product_slug: str
    base_price: float
    sale_price: Optional[float]
    discount_percent: int
    primary_image_url: Optional[str]
    is_in_stock: bool
    added_at: datetime


class WishlistResponse(BaseModel):
    id: str
    user_id: str
    items: List[WishlistItemResponse]
    item_count: int
