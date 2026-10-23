from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.catalog import Product, ProductVariant, ProductImage, Category, Brand
from app.models.order import Order, OrderItem, OrderStatus, Payment, PaymentStatus
from app.models.coupon import Coupon
from app.schemas.admin import AdminMetricsResponse
from app.schemas.order import OrderResponse, OrderStatusUpdateRequest
from app.schemas.catalog import (
    ProductCreate,
    ProductUpdate,
    ProductDetailResponse,
    CategoryCreate,
    CategoryResponse,
    BrandCreate,
    BrandResponse,
    ProductVariantCreate,
    ProductVariantUpdate,
    ProductVariantResponse,
    ProductImageCreate,
    ProductImageResponse,
)
from app.schemas.coupon import CouponCreate, CouponResponse
from app.services.catalog_service import CatalogService
from app.services.order_service import OrderService
from app.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Administrator Dashboard"])


@router.get("/metrics", response_model=AdminMetricsResponse)
def get_admin_metrics(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # Total revenue from non-cancelled orders
    total_sales = db.query(func.coalesce(func.sum(Order.total_amount), 0.0))\
                    .filter(Order.status != OrderStatus.CANCELLED)\
                    .scalar()

    total_orders = db.query(Order).count()
    total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()
    total_products = db.query(Product).count()

    pending_orders = db.query(Order).filter(Order.status.in_([OrderStatus.PENDING, OrderStatus.PLACED])).count()
    shipped_orders = db.query(Order).filter(Order.status == OrderStatus.SHIPPED).count()
    delivered_orders = db.query(Order).filter(Order.status == OrderStatus.DELIVERED).count()

    low_stock_count = db.query(ProductVariant).filter(
        ProductVariant.is_active == True,
        ProductVariant.stock_quantity < 5
    ).count()

    # Sales by gender breakdown from actual order items
    gender_rows = db.query(
        Product.gender,
        func.coalesce(func.sum(OrderItem.total_price), 0.0)
    ).join(OrderItem, OrderItem.product_id == Product.id)\
     .join(Order, OrderItem.order_id == Order.id)\
     .filter(Order.status != OrderStatus.CANCELLED)\
     .group_by(Product.gender)\
     .all()

    sales_by_gender = {str(row[0].value if hasattr(row[0], 'value') else row[0]): float(row[1]) for row in gender_rows}

    # Recent orders
    recent_orders_db = db.query(Order).order_by(desc(Order.created_at)).limit(10).all()
    recent_orders = [OrderResponse.model_validate(o) for o in recent_orders_db]

    return AdminMetricsResponse(
        total_sales=float(total_sales),
        total_orders=total_orders,
        total_customers=total_customers,
        total_products=total_products,
        pending_orders=pending_orders,
        shipped_orders=shipped_orders,
        delivered_orders=delivered_orders,
        low_stock_count=low_stock_count,
        sales_by_gender=sales_by_gender,
        recent_orders=recent_orders,
    )


# Product Management
@router.post("/products", response_model=ProductDetailResponse, status_code=status.HTTP_201_CREATED)
def admin_create_product(
    data: ProductCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = CatalogService.create_product(db, data)
    return CatalogService._build_detail_response(db, product)


@router.put("/products/{product_id}", response_model=ProductDetailResponse)
def admin_update_product(
    product_id: str,
    data: ProductUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = CatalogService.update_product(db, product_id, data)
    return CatalogService._build_detail_response(db, product)


@router.delete("/products/{product_id}")
def admin_delete_product(
    product_id: str,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    db.delete(product)
    db.commit()
    return {"message": "Product removed successfully."}


# Variant Management
@router.post("/products/{product_id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
def admin_add_variant(
    product_id: str,
    data: ProductVariantCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    variant = ProductVariant(
        product_id=product.id,
        size=data.size,
        color_name=data.color_name,
        color_hex=data.color_hex,
        sku=data.sku,
        price_override=data.price_override,
        stock_quantity=data.stock_quantity,
        is_active=data.is_active,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.put("/variants/{variant_id}", response_model=ProductVariantResponse)
def admin_update_variant(
    variant_id: str,
    data: ProductVariantUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found.")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(variant, k, v)

    db.commit()
    db.refresh(variant)
    return variant


# Image Management
@router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
def admin_add_image(
    product_id: str,
    data: ProductImageCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    if data.is_primary:
        db.query(ProductImage).filter(ProductImage.product_id == product_id).update({"is_primary": False})

    img = ProductImage(
        product_id=product_id,
        variant_id=data.variant_id,
        image_url=data.image_url,
        alt_text=data.alt_text,
        is_primary=data.is_primary,
        display_order=data.display_order,
    )
    db.add(img)
    db.commit()
    db.refresh(img)
    return img


# Categories & Brands
@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def admin_create_category(
    data: CategoryCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    cat = Category(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.post("/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
def admin_create_brand(
    data: BrandCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    brand = Brand(**data.model_dump())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


# Orders Management
@router.get("/orders", response_model=List[OrderResponse])
def admin_list_orders(
    status: Optional[OrderStatus] = Query(None),
    payment_provider: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if payment_provider:
        query = query.join(Payment, Payment.order_id == Order.id).filter(Payment.provider == payment_provider)
    orders = query.order_by(desc(Order.created_at)).limit(limit).all()
    return [OrderResponse.model_validate(o) for o in orders]


@router.put("/orders/{order_id}/status", response_model=OrderResponse)
def admin_update_order_status(
    order_id: str,
    data: OrderStatusUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return OrderService.update_order_status_admin(db, order_id=order_id, data=data)


# Coupons Management
@router.get("/coupons", response_model=List[CouponResponse])
def admin_list_coupons(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(Coupon).order_by(desc(Coupon.created_at)).all()


@router.post("/coupons", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
def admin_create_coupon(
    data: CouponCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    coupon = Coupon(**data.model_dump())
    coupon.code = coupon.code.upper().strip()
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.post("/import-seed-catalog")
def admin_import_seed_catalog(admin: User = Depends(get_current_admin)):
    from app.utils.seed_catalog import seed_store
    seed_store()
    return {"success": True, "message": "Authentic garment catalog and imagery re-synced successfully."}


# Automated Polling and Payment Status Reconciliation Controls
@router.get("/payments/polling-status")
def admin_get_polling_status(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Returns execution status and metrics for the automated status polling worker."""
    from app.services.polling_service import PollingService
    return PollingService.get_polling_status(db)


@router.post("/payments/poll-now")
def admin_trigger_poll_now(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Manually triggers an immediate polling run for all pending transactions."""
    from app.services.polling_service import PollingService
    result = PollingService.poll_all_pending(db)
    return {
        "success": True,
        "message": "PayYantra automated reconciler executed successfully.",
        **result,
    }


@router.post("/orders/{order_id}/refresh-payment-status")
def admin_refresh_order_payment_status(
    order_id: str,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Manually checks and synchronizes payment status for an order with PayYantra.
    Updates PostgreSQL only if verified provider response confirms status.
    """
    from app.services.payyantra_service import PayYantraService
    return PayYantraService.verify_and_sync_order_status(db=db, order_id=order_id, user=admin)


# Newsletter Club Subscribers Management
@router.get("/newsletter/subscribers")
def admin_list_newsletter_subscribers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin-only search, filter, and pagination of newsletter subscribers."""
    from app.services.newsletter_service import NewsletterService
    return NewsletterService.list_subscribers_admin(
        db=db, search=search, status_filter=status, page=page, limit=limit
    )


@router.get("/newsletter/export")
def admin_export_newsletter_subscribers(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Exports all newsletter club subscribers as a compliance-ready CSV."""
    from fastapi.responses import Response
    from app.services.newsletter_service import NewsletterService
    csv_content = NewsletterService.export_csv(db=db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="varnyxa_subscribers.csv"'},
    )


@router.put("/newsletter/subscribers/{subscriber_id}/status")
def admin_update_subscriber_status(
    subscriber_id: str,
    status: str = Query(..., pattern="^(active|unsubscribed)$"),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Authorized admin toggle of a subscriber's membership status."""
    from app.services.newsletter_service import NewsletterService
    return NewsletterService.update_subscriber_status_admin(
        db=db, subscriber_id=subscriber_id, new_status=status
    )

