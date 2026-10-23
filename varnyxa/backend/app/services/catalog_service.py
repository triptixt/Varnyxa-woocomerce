import math
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import func, or_, and_, desc, asc
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.catalog import Product, ProductVariant, ProductImage, Category, Brand, Gender, AgeGroup
from app.models.review import Review
from app.schemas.catalog import (
    ProductListItemResponse,
    ProductDetailResponse,
    PaginatedProductsResponse,
    CategoryResponse,
    BrandResponse,
    ProductVariantResponse,
    ProductImageResponse,
    ProductCreate,
    ProductUpdate
)


class CatalogService:
    @staticmethod
    def get_products(
        db: Session,
        gender: Optional[str] = None,
        age_group: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        size: Optional[str] = None,
        color: Optional[str] = None,
        fabric: Optional[str] = None,
        fit: Optional[str] = None,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        in_stock: Optional[bool] = None,
        is_featured: Optional[bool] = None,
        search: Optional[str] = None,
        sort: Optional[str] = "recommended",
        page: int = 1,
        limit: int = 24,
    ) -> PaginatedProductsResponse:
        query = db.query(Product).filter(Product.is_active == True)

        # Strict Gender Filtering
        if gender:
            gender_val = gender.lower().strip()
            if gender_val != "all":
                try:
                    target_gender = Gender(gender_val)
                    query = query.filter(Product.gender == target_gender)
                except ValueError:
                    # Invalid gender passed - strictly return empty to prevent unintended leaks
                    query = query.filter(Product.id == "non_existent_gender_match")

        if age_group:
            age_val = age_group.lower().strip()
            if age_val != "all":
                query = query.filter(Product.age_group == age_val)

        if category:
            # Match by slug or id or name
            cat_obj = db.query(Category).filter(
                or_(Category.slug == category.lower(), Category.id == category)
            ).first()
            if cat_obj:
                # Include parent category and subcategories
                subcat_ids = [c.id for c in db.query(Category.id).filter(Category.parent_id == cat_obj.id).all()]
                target_ids = [cat_obj.id] + subcat_ids
                query = query.filter(Product.category_id.in_(target_ids))

        if brand:
            brand_obj = db.query(Brand).filter(
                or_(Brand.slug == brand.lower(), Brand.id == brand)
            ).first()
            if brand_obj:
                query = query.filter(Product.brand_id == brand_obj.id)

        if min_price is not None:
            query = query.filter(
                func.coalesce(Product.sale_price, Product.base_price) >= min_price
            )

        if max_price is not None:
            query = query.filter(
                func.coalesce(Product.sale_price, Product.base_price) <= max_price
            )

        if fabric:
            query = query.filter(Product.fabric.ilike(f"%{fabric.strip()}%"))

        if fit:
            query = query.filter(Product.fit.ilike(f"%{fit.strip()}%"))

        if occasion:
            query = query.filter(Product.occasion.ilike(f"%{occasion.strip()}%"))

        if season:
            query = query.filter(Product.season.ilike(f"%{season.strip()}%"))

        if is_featured is not None:
            query = query.filter(Product.is_featured == is_featured)

        # Comprehensive Intelligent Multi-Field Search Query
        if search:
            raw_search = search.strip()
            tokens = [t.lower() for t in raw_search.split() if t.strip()]

            if tokens:
                query = query.outerjoin(Category, Product.category_id == Category.id)\
                             .outerjoin(Brand, Product.brand_id == Brand.id)

                def get_token_condition(token: str):
                    term = f"%{token}%"
                    conds = [
                        Product.title.ilike(term),
                        Product.description.ilike(term),
                        Product.fabric.ilike(term),
                        Product.fit.ilike(term),
                        Product.occasion.ilike(term),
                        Product.season.ilike(term),
                        Category.name.ilike(term),
                        Category.slug.ilike(term),
                        Brand.name.ilike(term),
                        # Variant color match
                        db.query(ProductVariant.id).filter(
                            ProductVariant.product_id == Product.id,
                            ProductVariant.is_active == True,
                            ProductVariant.color_name.ilike(term)
                        ).exists(),
                        # Variant size match
                        db.query(ProductVariant.id).filter(
                            ProductVariant.product_id == Product.id,
                            ProductVariant.is_active == True,
                            func.lower(ProductVariant.size) == token
                        ).exists(),
                    ]

                    # Strict gender semantics
                    if token in ["men", "man", "mens", "male"]:
                        conds.append(Product.gender == Gender.MEN)
                    elif token in ["women", "woman", "womens", "female", "lady", "ladies"]:
                        conds.append(Product.gender == Gender.WOMEN)
                    elif token in ["unisex"]:
                        conds.append(Product.gender == Gender.UNISEX)
                    elif token in ["boy", "boys"]:
                        conds.append(Product.gender == Gender.BOYS)
                    elif token in ["girl", "girls"]:
                        conds.append(Product.gender == Gender.GIRLS)
                    elif token in ["baby", "babies", "infant", "infants", "newborn", "newborns", "toddler", "toddlers"]:
                        conds.append(Product.gender == Gender.BABY)
                    elif token in ["kid", "kids", "children", "child", "junior", "juniors", "petite"]:
                        conds.append(or_(
                            Product.gender.in_([Gender.BOYS, Gender.GIRLS, Gender.BABY]),
                            Product.age_group.in_([AgeGroup.KIDS, AgeGroup.TODDLER, AgeGroup.INFANT, AgeGroup.NEWBORN])
                        ))
                    elif token in ["teen", "teens", "teenager", "teenagers"]:
                        conds.append(Product.age_group == AgeGroup.TEENS)
                    elif token in ["senior", "seniors", "elderly"]:
                        conds.append(Product.age_group == AgeGroup.SENIORS)
                    elif token in ["adult", "adults"]:
                        conds.append(Product.age_group == AgeGroup.ADULTS)

                    return or_(*conds)

                token_conditions = [get_token_condition(t) for t in tokens]
                and_query = query.filter(and_(*token_conditions))
                if and_query.count() > 0:
                    query = and_query
                else:
                    query = query.filter(or_(*token_conditions))

        # Variant based filters (size, color, in_stock)
        if size or color or in_stock:
            variant_filter = [ProductVariant.is_active == True]
            if size:
                sizes = [s.strip() for s in size.split(",") if s.strip()]
                variant_filter.append(ProductVariant.size.in_(sizes))
            if color:
                colors = [c.strip().lower() for c in color.split(",") if c.strip()]
                variant_filter.append(func.lower(ProductVariant.color_name).in_(colors))
            if in_stock:
                variant_filter.append(ProductVariant.stock_quantity > 0)

            matching_product_ids = db.query(ProductVariant.product_id)\
                                     .filter(and_(*variant_filter))\
                                     .distinct().subquery()
            query = query.filter(Product.id.in_(matching_product_ids))

        # Total count before pagination
        total = query.count()
        pages = math.ceil(total / limit) if total > 0 else 1

        # Sorting
        effective_price = func.coalesce(Product.sale_price, Product.base_price)
        if sort == "price_asc":
            query = query.order_by(asc(effective_price))
        elif sort == "price_desc":
            query = query.order_by(desc(effective_price))
        elif sort == "newest":
            query = query.order_by(desc(Product.created_at))
        elif sort == "discount_desc":
            query = query.order_by(desc(Product.discount_percent))
        else:  # "recommended"
            query = query.order_by(desc(Product.is_featured), desc(Product.created_at))

        # Paginate
        offset = (max(1, page) - 1) * limit
        products = query.offset(offset).limit(limit).all()

        # Build list response items
        items = [CatalogService._build_list_item(db, p) for p in products]

        # Get facets for filter sidebar
        facets = CatalogService._get_facets(db)

        return PaginatedProductsResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
            min_price=facets.get("min_price", 0.0),
            max_price=facets.get("max_price", 0.0),
            available_categories=facets.get("categories", []),
            available_brands=facets.get("brands", []),
            available_fabrics=facets.get("fabrics", []),
            available_fits=facets.get("fits", []),
            available_occasions=facets.get("occasions", []),
        )

    @staticmethod
    def get_product_by_slug(db: Session, slug: str) -> ProductDetailResponse:
        product = db.query(Product)\
                    .filter(Product.slug == slug, Product.is_active == True)\
                    .first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product '{slug}' not found.",
            )
        return CatalogService._build_detail_response(db, product)

    @staticmethod
    def get_product_by_id(db: Session, product_id: str) -> ProductDetailResponse:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID '{product_id}' not found.",
            )
        return CatalogService._build_detail_response(db, product)

    @staticmethod
    def _build_list_item(db: Session, product: Product) -> ProductListItemResponse:
        # Primary image
        primary_img = db.query(ProductImage.image_url)\
                        .filter(ProductImage.product_id == product.id, ProductImage.is_primary == True)\
                        .first()
        if not primary_img:
            primary_img = db.query(ProductImage.image_url)\
                            .filter(ProductImage.product_id == product.id)\
                            .order_by(ProductImage.display_order)\
                            .first()
        img_url = primary_img[0] if primary_img else None

        # Category and brand name
        cat_name = product.category.name if product.category else "Fashion"
        brand_name = product.brand.name if product.brand else None

        # Rating stats from real database reviews
        rating_stats = db.query(
            func.coalesce(func.avg(Review.rating), 0.0),
            func.count(Review.id)
        ).filter(Review.product_id == product.id, Review.is_approved == True).first()
        avg_rating = round(float(rating_stats[0]), 1) if rating_stats else 0.0
        review_count = int(rating_stats[1]) if rating_stats else 0

        # Variant summaries: stock, sizes, unique colors
        variants = db.query(ProductVariant)\
                     .filter(ProductVariant.product_id == product.id, ProductVariant.is_active == True)\
                     .all()
        total_stock = sum(v.stock_quantity for v in variants)
        sizes = list(dict.fromkeys(v.size for v in variants))
        
        # Color objects
        colors_dict = {}
        for v in variants:
            if v.color_name not in colors_dict:
                colors_dict[v.color_name] = {"name": v.color_name, "hex": v.color_hex}
        colors = list(colors_dict.values())

        return ProductListItemResponse(
            id=product.id,
            title=product.title,
            slug=product.slug,
            base_price=float(product.base_price),
            sale_price=float(product.sale_price) if product.sale_price else None,
            discount_percent=product.discount_percent,
            gender=product.gender,
            age_group=product.age_group,
            category_name=cat_name,
            brand_name=brand_name,
            primary_image_url=img_url,
            rating_average=avg_rating,
            review_count=review_count,
            total_stock=total_stock,
            available_sizes=sizes,
            available_colors=colors,
            is_featured=product.is_featured,
        )

    @staticmethod
    def _build_detail_response(db: Session, product: Product) -> ProductDetailResponse:
        # Reviews stats
        rating_stats = db.query(
            func.coalesce(func.avg(Review.rating), 0.0),
            func.count(Review.id)
        ).filter(Review.product_id == product.id, Review.is_approved == True).first()
        avg_rating = round(float(rating_stats[0]), 1) if rating_stats else 0.0
        review_count = int(rating_stats[1]) if rating_stats else 0

        # Active variants
        variants = db.query(ProductVariant)\
                     .filter(ProductVariant.product_id == product.id, ProductVariant.is_active == True)\
                     .all()
        total_stock = sum(v.stock_quantity for v in variants)

        # Images ordered
        images = db.query(ProductImage)\
                   .filter(ProductImage.product_id == product.id)\
                   .order_by(desc(ProductImage.is_primary), ProductImage.display_order)\
                   .all()

        return ProductDetailResponse(
            id=product.id,
            title=product.title,
            slug=product.slug,
            description=product.description,
            material_care=product.material_care,
            sku_prefix=product.sku_prefix,
            base_price=float(product.base_price),
            sale_price=float(product.sale_price) if product.sale_price else None,
            discount_percent=product.discount_percent,
            gender=product.gender,
            age_group=product.age_group,
            category=CategoryResponse.model_validate(product.category),
            brand=BrandResponse.model_validate(product.brand) if product.brand else None,
            fabric=product.fabric,
            fit=product.fit,
            sleeve_length=product.sleeve_length,
            occasion=product.occasion,
            season=product.season,
            is_featured=product.is_featured,
            is_active=product.is_active,
            created_at=product.created_at,
            updated_at=product.updated_at,
            variants=[ProductVariantResponse.model_validate(v) for v in variants],
            images=[ProductImageResponse.model_validate(img) for img in images],
            rating_average=avg_rating,
            review_count=review_count,
            total_stock=total_stock,
        )

    @staticmethod
    def _get_facets(db: Session) -> Dict[str, Any]:
        # Price range
        price_stats = db.query(
            func.min(func.coalesce(Product.sale_price, Product.base_price)),
            func.max(func.coalesce(Product.sale_price, Product.base_price))
        ).filter(Product.is_active == True).first()
        min_p = float(price_stats[0]) if price_stats and price_stats[0] is not None else 0.0
        max_p = float(price_stats[1]) if price_stats and price_stats[1] is not None else 10000.0

        # Categories with count
        cats = db.query(Category.id, Category.name, Category.slug, func.count(Product.id))\
                 .join(Product, Product.category_id == Category.id)\
                 .filter(Product.is_active == True)\
                 .group_by(Category.id, Category.name, Category.slug)\
                 .all()
        categories_data = [{"id": c[0], "name": c[1], "slug": c[2], "count": c[3]} for c in cats]

        # Brands
        brands = db.query(Brand.id, Brand.name, Brand.slug, func.count(Product.id))\
                   .join(Product, Product.brand_id == Brand.id)\
                   .filter(Product.is_active == True)\
                   .group_by(Brand.id, Brand.name, Brand.slug)\
                   .all()
        brands_data = [{"id": b[0], "name": b[1], "slug": b[2], "count": b[3]} for b in brands]

        # Fabrics
        fabrics = [r[0] for r in db.query(Product.fabric).filter(Product.is_active == True, Product.fabric != None).distinct().all() if r[0]]
        # Fits
        fits = [r[0] for r in db.query(Product.fit).filter(Product.is_active == True, Product.fit != None).distinct().all() if r[0]]
        # Occasions
        occasions = [r[0] for r in db.query(Product.occasion).filter(Product.is_active == True, Product.occasion != None).distinct().all() if r[0]]

        return {
            "min_price": min_p,
            "max_price": max_p,
            "categories": categories_data,
            "brands": brands_data,
            "fabrics": fabrics,
            "fits": fits,
            "occasions": occasions,
        }

    # Admin Catalog CRUD
    @staticmethod
    def create_product(db: Session, data: ProductCreate) -> Product:
        # Check slug
        existing = db.query(Product).filter(Product.slug == data.slug).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with slug '{data.slug}' already exists.",
            )

        new_product = Product(
            title=data.title,
            slug=data.slug,
            description=data.description,
            material_care=data.material_care,
            sku_prefix=data.sku_prefix,
            base_price=data.base_price,
            sale_price=data.sale_price,
            discount_percent=data.discount_percent,
            gender=data.gender,
            age_group=data.age_group,
            category_id=data.category_id,
            brand_id=data.brand_id,
            fabric=data.fabric,
            fit=data.fit,
            sleeve_length=data.sleeve_length,
            occasion=data.occasion,
            season=data.season,
            is_featured=data.is_featured,
            is_active=data.is_active,
        )
        db.add(new_product)
        db.flush()

        for v in data.variants:
            variant = ProductVariant(
                product_id=new_product.id,
                size=v.size,
                color_name=v.color_name,
                color_hex=v.color_hex,
                sku=v.sku,
                price_override=v.price_override,
                stock_quantity=v.stock_quantity,
                is_active=v.is_active,
            )
            db.add(variant)

        for img in data.images:
            image = ProductImage(
                product_id=new_product.id,
                image_url=img.image_url,
                alt_text=img.alt_text,
                is_primary=img.is_primary,
                display_order=img.display_order,
            )
            db.add(image)

        db.commit()
        db.refresh(new_product)
        return new_product

    @staticmethod
    def update_product(db: Session, product_id: str, data: ProductUpdate) -> Product:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(product, key, value)

        db.commit()
        db.refresh(product)
        return product
