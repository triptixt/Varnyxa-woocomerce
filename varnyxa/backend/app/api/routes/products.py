from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.db.session import get_db
from app.models.catalog import Category, Brand, Product
from app.schemas.catalog import (
    PaginatedProductsResponse,
    ProductDetailResponse,
    ProductListItemResponse,
    CategoryResponse,
    BrandResponse,
)
from app.services.catalog_service import CatalogService

router = APIRouter(prefix="/products", tags=["Catalog"])


@router.get("", response_model=PaginatedProductsResponse, include_in_schema=False)
@router.get("/", response_model=PaginatedProductsResponse)
def get_products_catalog(
    gender: Optional[str] = Query(None, description="Gender filter (men, women, unisex, boys, girls, baby)"),
    age_group: Optional[str] = Query(None, description="Age group (newborn, infant, toddler, kids, teens, adults, seniors)"),
    category: Optional[str] = Query(None, description="Category slug or ID"),
    brand: Optional[str] = Query(None, description="Brand slug or ID"),
    min_price: Optional[float] = Query(None, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, description="Maximum price filter"),
    size: Optional[str] = Query(None, description="Size filter (comma separated: S,M,L)"),
    color: Optional[str] = Query(None, description="Color filter (comma separated: Black,Navy)"),
    fabric: Optional[str] = Query(None, description="Fabric filter"),
    fit: Optional[str] = Query(None, description="Fit filter"),
    occasion: Optional[str] = Query(None, description="Occasion filter"),
    season: Optional[str] = Query(None, description="Season filter"),
    in_stock: Optional[bool] = Query(None, description="Only in-stock garments"),
    is_featured: Optional[bool] = Query(None, description="Featured items"),
    search: Optional[str] = Query(None, description="Search term"),
    sort: Optional[str] = Query("recommended", description="Sorting option: recommended, newest, price_asc, price_desc, discount_desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return CatalogService.get_products(
        db=db,
        gender=gender,
        age_group=age_group,
        category=category,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        size=size,
        color=color,
        fabric=fabric,
        fit=fit,
        occasion=occasion,
        season=season,
        in_stock=in_stock,
        is_featured=is_featured,
        search=search,
        sort=sort,
        page=page,
        limit=limit,
    )


@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.is_active == True).order_by(Category.display_order, Category.name).all()


@router.get("/brands", response_model=List[BrandResponse])
def get_brands(db: Session = Depends(get_db)):
    return db.query(Brand).order_by(Brand.name).all()


@router.get("/price-bounds")
def get_price_bounds(db: Session = Depends(get_db)):
    effective_price = func.coalesce(Product.sale_price, Product.base_price)
    stats = db.query(
        func.min(effective_price),
        func.max(effective_price)
    ).filter(Product.is_active == True).first()

    catalog_min = float(stats[0]) if stats and stats[0] is not None else 150.0
    catalog_max = float(stats[1]) if stats and stats[1] is not None else 50000.0

    # Ensure min slider starts at 150, or catalog_min if lower
    min_slider = min(150.0, catalog_min)
    max_slider = max(catalog_max, 5000.0)

    # Preset counts across active products
    under_500 = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        effective_price >= 150.0,
        effective_price < 500.0
    ).scalar() or 0

    p_500_1000 = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        effective_price >= 500.0,
        effective_price <= 1000.0
    ).scalar() or 0

    p_1000_2500 = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        effective_price >= 1000.0,
        effective_price <= 2500.0
    ).scalar() or 0

    p_2500_5000 = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        effective_price >= 2500.0,
        effective_price <= 5000.0
    ).scalar() or 0

    p_5000_above = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        effective_price >= 5000.0
    ).scalar() or 0

    return {
        "min_price": min_slider,
        "max_price": max_slider,
        "catalog_min_price": catalog_min,
        "catalog_max_price": catalog_max,
        "preset_counts": {
            "under_500": under_500,
            "500_1000": p_500_1000,
            "1000_2500": p_1000_2500,
            "2500_5000": p_2500_5000,
            "5000_above": p_5000_above,
        }
    }


@router.get("/featured", response_model=List[ProductListItemResponse])
def get_featured_products(limit: int = Query(8, ge=1, le=20), db: Session = Depends(get_db)):
    res = CatalogService.get_products(db=db, is_featured=True, limit=limit)
    return res.items


@router.get("/new-arrivals", response_model=List[ProductListItemResponse])
def get_new_arrivals(limit: int = Query(8, ge=1, le=20), db: Session = Depends(get_db)):
    res = CatalogService.get_products(db=db, sort="newest", limit=limit)
    return res.items


@router.get("/best-sellers", response_model=List[ProductListItemResponse])
def get_best_sellers(limit: int = Query(8, ge=1, le=20), db: Session = Depends(get_db)):
    res = CatalogService.get_products(db=db, sort="recommended", limit=limit)
    return res.items


@router.get("/slug/{slug}", response_model=ProductDetailResponse)
def get_product_by_slug(slug: str, db: Session = Depends(get_db)):
    return CatalogService.get_product_by_slug(db, slug)


@router.get("/id/{product_id}", response_model=ProductDetailResponse)
def get_product_by_id(product_id: str, db: Session = Depends(get_db)):
    return CatalogService.get_product_by_id(db, product_id)


@router.get("/{product_id}/related", response_model=List[ProductListItemResponse])
def get_related_products(product_id: str, limit: int = Query(4, ge=1, le=12), db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        return []
    res = CatalogService.get_products(
        db=db,
        gender=prod.gender.value,
        category=prod.category.slug if prod.category else None,
        limit=limit + 1
    )
    return [p for p in res.items if p.id != product_id][:limit]
