from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.session import get_db
from app.models.review import Review
from app.models.order import Order, OrderItem, OrderStatus
from app.models.catalog import Product
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.get("/product/{product_id}", response_model=List[ReviewResponse])
def get_product_reviews(product_id: str, db: Session = Depends(get_db)):
    reviews = db.query(Review)\
                .filter(Review.product_id == product_id, Review.is_approved == True)\
                .order_by(desc(Review.created_at))\
                .all()
    
    return [
        ReviewResponse(
            id=r.id,
            product_id=r.product_id,
            user_id=r.user_id,
            user_name=r.user.full_name if r.user else "Customer",
            rating=r.rating,
            title=r.title,
            comment=r.comment,
            is_verified_purchase=r.is_verified_purchase,
            created_at=r.created_at,
        )
        for r in reviews
    ]


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def submit_review(
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    # Check if verified purchase: Has the user completed an order with this product?
    has_purchased = db.query(OrderItem)\
                      .join(Order, OrderItem.order_id == Order.id)\
                      .filter(
                          Order.user_id == current_user.id,
                          OrderItem.product_id == data.product_id,
                          Order.status.in_([OrderStatus.DELIVERED, OrderStatus.CONFIRMED, OrderStatus.SHIPPED])
                      ).first() is not None

    new_review = Review(
        product_id=data.product_id,
        user_id=current_user.id,
        rating=data.rating,
        title=data.title,
        comment=data.comment.strip(),
        is_verified_purchase=has_purchased,
        is_approved=True,
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return ReviewResponse(
        id=new_review.id,
        product_id=new_review.product_id,
        user_id=new_review.user_id,
        user_name=current_user.full_name,
        rating=new_review.rating,
        title=new_review.title,
        comment=new_review.comment,
        is_verified_purchase=new_review.is_verified_purchase,
        created_at=new_review.created_at,
    )
