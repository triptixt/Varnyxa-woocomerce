from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.schemas.order import OrderResponse


class AdminMetricsResponse(BaseModel):
    total_sales: float
    total_orders: int
    total_customers: int
    total_products: int
    pending_orders: int
    shipped_orders: int
    delivered_orders: int
    low_stock_count: int
    sales_by_gender: Dict[str, float]
    recent_orders: List[OrderResponse]
