from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.catalog import Gender, AgeGroup


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class CategoryResponse(CategoryBase):
    id: str

    class Config:
        from_attributes = True


class BrandBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=120)
    logo_url: Optional[str] = None
    description: Optional[str] = None


class BrandCreate(BrandBase):
    pass


class BrandResponse(BrandBase):
    id: str

    class Config:
        from_attributes = True


class ProductImageBase(BaseModel):
    image_url: str = Field(..., min_length=5, max_length=500)
    alt_text: str = Field(..., min_length=2, max_length=255)
    is_primary: bool = False
    display_order: int = 0
    variant_id: Optional[str] = None


class ProductImageCreate(ProductImageBase):
    pass


class ProductImageResponse(ProductImageBase):
    id: str
    product_id: str

    class Config:
        from_attributes = True


class ProductVariantBase(BaseModel):
    size: str = Field(..., min_length=1, max_length=20)
    color_name: str = Field(..., min_length=1, max_length=50)
    color_hex: str = Field(..., min_length=4, max_length=10)
    sku: str = Field(..., min_length=3, max_length=100)
    price_override: Optional[float] = None
    stock_quantity: int = Field(default=0, ge=0)
    is_active: bool = True


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantUpdate(BaseModel):
    size: Optional[str] = None
    color_name: Optional[str] = None
    color_hex: Optional[str] = None
    sku: Optional[str] = None
    price_override: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None


class ProductVariantResponse(ProductVariantBase):
    id: str
    product_id: str

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=280)
    description: str = Field(..., min_length=10)
    material_care: Optional[str] = None
    sku_prefix: str = Field(..., min_length=2, max_length=50)
    base_price: float = Field(..., gt=0)
    sale_price: Optional[float] = Field(None, gt=0)
    discount_percent: int = Field(default=0, ge=0, le=100)
    gender: Gender
    age_group: AgeGroup
    category_id: str
    brand_id: Optional[str] = None
    fabric: Optional[str] = None
    fit: Optional[str] = None
    sleeve_length: Optional[str] = None
    occasion: Optional[str] = None
    season: Optional[str] = None
    is_featured: bool = False
    is_active: bool = True


class ProductCreate(ProductBase):
    variants: List[ProductVariantCreate] = []
    images: List[ProductImageCreate] = []


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    material_care: Optional[str] = None
    sku_prefix: Optional[str] = None
    base_price: Optional[float] = None
    sale_price: Optional[float] = None
    discount_percent: Optional[int] = None
    gender: Optional[Gender] = None
    age_group: Optional[AgeGroup] = None
    category_id: Optional[str] = None
    brand_id: Optional[str] = None
    fabric: Optional[str] = None
    fit: Optional[str] = None
    sleeve_length: Optional[str] = None
    occasion: Optional[str] = None
    season: Optional[str] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductListItemResponse(BaseModel):
    id: str
    title: str
    slug: str
    base_price: float
    sale_price: Optional[float]
    discount_percent: int
    gender: Gender
    age_group: AgeGroup
    category_name: str
    brand_name: Optional[str]
    primary_image_url: Optional[str]
    rating_average: float = 0.0
    review_count: int = 0
    total_stock: int = 0
    available_sizes: List[str] = []
    available_colors: List[dict] = []
    is_featured: bool = False

    class Config:
        from_attributes = True


class ProductDetailResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: str
    material_care: Optional[str]
    sku_prefix: str
    base_price: float
    sale_price: Optional[float]
    discount_percent: int
    gender: Gender
    age_group: AgeGroup
    category: CategoryResponse
    brand: Optional[BrandResponse] = None
    fabric: Optional[str]
    fit: Optional[str]
    sleeve_length: Optional[str]
    occasion: Optional[str]
    season: Optional[str]
    is_featured: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    variants: List[ProductVariantResponse]
    images: List[ProductImageResponse]
    rating_average: float = 0.0
    review_count: int = 0
    total_stock: int = 0

    class Config:
        from_attributes = True


class PaginatedProductsResponse(BaseModel):
    items: List[ProductListItemResponse]
    total: int
    page: int
    limit: int
    pages: int
    min_price: float = 0.0
    max_price: float = 0.0
    available_categories: List[dict] = []
    available_brands: List[dict] = []
    available_fabrics: List[str] = []
    available_fits: List[str] = []
    available_occasions: List[str] = []
