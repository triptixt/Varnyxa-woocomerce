import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Integer, Numeric, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.cart import CartItem
    from app.models.wishlist import WishlistItem
    from app.models.review import Review


class Gender(str, enum.Enum):
    MEN = "men"
    WOMEN = "women"
    UNISEX = "unisex"
    BOYS = "boys"
    GIRLS = "girls"
    BABY = "baby"


class AgeGroup(str, enum.Enum):
    NEWBORN = "newborn"
    INFANT = "infant"
    TODDLER = "toddler"
    KIDS = "kids"
    TEENS = "teens"
    ADULTS = "adults"
    SENIORS = "seniors"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    parent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    parent: Mapped[Optional["Category"]] = relationship("Category", remote_side=[id], back_populates="subcategories")
    subcategories: Mapped[List["Category"]] = relationship("Category", back_populates="parent")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    products: Mapped[List["Product"]] = relationship("Product", back_populates="brand")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(280), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    material_care: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sku_prefix: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Pricing in INR
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    sale_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    gender: Mapped[Gender] = mapped_column(Enum(Gender), index=True, nullable=False)
    age_group: Mapped[AgeGroup] = mapped_column(Enum(AgeGroup), index=True, nullable=False)
    
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("categories.id"), index=True, nullable=False)
    brand_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("brands.id"), index=True, nullable=True)

    fabric: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    fit: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    sleeve_length: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    occasion: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    season: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)

    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    category: Mapped["Category"] = relationship("Category", back_populates="products")
    brand: Mapped[Optional["Brand"]] = relationship("Brand", back_populates="products")
    variants: Mapped[List["ProductVariant"]] = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images: Mapped[List["ProductImage"]] = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.display_order")
    reviews: Mapped[List["Review"]] = relationship("Review", back_populates="product", cascade="all, delete-orphan")
    wishlist_items: Mapped[List["WishlistItem"]] = relationship("WishlistItem", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_product_filter", "gender", "age_group", "category_id", "is_active"),
    )


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    
    size: Mapped[str] = mapped_column(String(20), index=True, nullable=False)  # XS, S, M, L, XL, XXL, 0-3M, 3-6M, etc.
    color_name: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # Black, Ivory, Navy, Olive, etc.
    color_hex: Mapped[str] = mapped_column(String(10), nullable=False)  # #000000, #FDFBF7, etc.
    sku: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    
    price_override: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="variants")
    cart_items: Mapped[List["CartItem"]] = relationship("CartItem", back_populates="variant")
    images: Mapped[List["ProductImage"]] = relationship("ProductImage", back_populates="variant")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    variant_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str] = mapped_column(String(255), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="images")
    variant: Mapped[Optional["ProductVariant"]] = relationship("ProductVariant", back_populates="images")
