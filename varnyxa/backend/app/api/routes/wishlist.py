from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.wishlist import Wishlist, WishlistItem
from app.models.catalog import Product, ProductImage, ProductVariant
from app.schemas.wishlist import WishlistResponse, WishlistItemResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])


@router.get("", response_model=WishlistResponse, include_in_schema=False)
@router.get("/", response_model=WishlistResponse)
def get_wishlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wishlist = db.query(Wishlist).filter(Wishlist.user_id == current_user.id).first()
    if not wishlist:
        wishlist = Wishlist(user_id=current_user.id)
        db.add(wishlist)
        db.commit()
        db.refresh(wishlist)

    items = db.query(WishlistItem).filter(WishlistItem.wishlist_id == wishlist.id).all()
    out_items = []
    for item in items:
        p = db.query(Product).filter(Product.id == item.product_id).first()
        if not p:
            continue

        # Primary image
        img = db.query(ProductImage.image_url).filter(
            ProductImage.product_id == p.id,
            ProductImage.is_primary == True
        ).first()
        if not img:
            img = db.query(ProductImage.image_url).filter(ProductImage.product_id == p.id).first()
        img_url = img[0] if img else None

        # Stock check
        in_stock = db.query(ProductVariant).filter(
            ProductVariant.product_id == p.id,
            ProductVariant.stock_quantity > 0,
            ProductVariant.is_active == True
        ).first() is not None

        out_items.append(WishlistItemResponse(
            id=item.id,
            product_id=p.id,
            product_title=p.title,
            product_slug=p.slug,
            base_price=float(p.base_price),
            sale_price=float(p.sale_price) if p.sale_price else None,
            discount_percent=p.discount_percent,
            primary_image_url=img_url,
            is_in_stock=in_stock,
            added_at=item.added_at,
        ))

    return WishlistResponse(
        id=wishlist.id,
        user_id=current_user.id,
        items=out_items,
        item_count=len(out_items),
    )


@router.post("/toggle/{product_id}")
def toggle_wishlist_item(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    wishlist = db.query(Wishlist).filter(Wishlist.user_id == current_user.id).first()
    if not wishlist:
        wishlist = Wishlist(user_id=current_user.id)
        db.add(wishlist)
        db.flush()

    item = db.query(WishlistItem).filter(
        WishlistItem.wishlist_id == wishlist.id,
        WishlistItem.product_id == product_id
    ).first()

    if item:
        db.delete(item)
        db.commit()
        return {"in_wishlist": False, "message": "Removed from wishlist."}
    else:
        new_item = WishlistItem(wishlist_id=wishlist.id, product_id=product_id)
        db.add(new_item)
        db.commit()
        return {"in_wishlist": True, "message": "Added to wishlist."}
