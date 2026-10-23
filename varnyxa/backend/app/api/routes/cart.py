from typing import Optional
from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.cart import CartResponse, CartItemAdd, CartItemUpdate, MergeCartRequest
from app.services.cart_service import CartService
from app.api.deps import get_optional_user, get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])


@router.get("", response_model=CartResponse, include_in_schema=False)
@router.get("/", response_model=CartResponse)
def get_cart(
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    coupon_code: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    cart = CartService.get_or_create_cart(db, user=current_user, session_token=x_session_token)
    return CartService.build_cart_response(db, cart, coupon_code=coupon_code)


@router.post("/items", response_model=CartResponse)
def add_item_to_cart(
    data: CartItemAdd,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    cart = CartService.get_or_create_cart(db, user=current_user, session_token=x_session_token)
    return CartService.add_to_cart(db, cart, data)


@router.put("/items/{item_id}", response_model=CartResponse)
def update_cart_item(
    item_id: str,
    data: CartItemUpdate,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    cart = CartService.get_or_create_cart(db, user=current_user, session_token=x_session_token)
    return CartService.update_cart_item(db, cart, item_id, data)


@router.delete("/items/{item_id}", response_model=CartResponse)
def remove_cart_item(
    item_id: str,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    cart = CartService.get_or_create_cart(db, user=current_user, session_token=x_session_token)
    return CartService.remove_cart_item(db, cart, item_id)


@router.delete("", response_model=CartResponse, include_in_schema=False)
@router.delete("/", response_model=CartResponse)
def clear_cart(
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    cart = CartService.get_or_create_cart(db, user=current_user, session_token=x_session_token)
    return CartService.clear_cart(db, cart)


@router.post("/merge", response_model=CartResponse)
def merge_cart(
    data: MergeCartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cart = CartService.merge_guest_cart(db, user=current_user, session_token=data.session_token)
    return CartService.build_cart_response(db, cart)
