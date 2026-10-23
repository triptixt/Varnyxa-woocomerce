from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.order import OrderCreateRequest, OrderResponse, OrderCancelRequest
from app.services.order_service import OrderService
from app.api.deps import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return OrderService.create_order(db, user=current_user, data=data)


@router.get("", response_model=List[OrderResponse], include_in_schema=False)
@router.get("/", response_model=List[OrderResponse])
def get_user_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return OrderService.get_user_orders(db, current_user)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order_by_id(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return OrderService.get_order_by_id(db, order_id, user=current_user)


@router.get("/{order_id}/receipt")
def get_order_receipt(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns official payment receipt data for a verified order.
    Restricted to authenticated owner or admin.
    """
    return OrderService.get_order_receipt(db, order_id, user=current_user)



@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: str,
    data: OrderCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return OrderService.cancel_order(db, order_id=order_id, user=current_user, reason=data.reason)
