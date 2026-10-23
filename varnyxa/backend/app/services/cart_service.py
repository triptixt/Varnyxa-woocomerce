import uuid
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.cart import Cart, CartItem
from app.models.catalog import ProductVariant, Product, ProductImage
from app.models.coupon import Coupon, DiscountType
from app.models.user import User
from app.schemas.cart import CartResponse, CartItemDetail, CartItemAdd, CartItemUpdate
from app.core.config import settings


class CartService:
    @staticmethod
    def get_or_create_cart(db: Session, user: Optional[User] = None, session_token: Optional[str] = None) -> Cart:
        if user:
            cart = db.query(Cart).filter(Cart.user_id == user.id).first()
            if not cart:
                cart = Cart(user_id=user.id)
                db.add(cart)
                db.commit()
                db.refresh(cart)
            return cart

        if session_token:
            cart = db.query(Cart).filter(Cart.session_token == session_token).first()
            if not cart:
                cart = Cart(session_token=session_token)
                db.add(cart)
                db.commit()
                db.refresh(cart)
            return cart

        # Generate new anonymous session token
        new_token = f"guest_{uuid.uuid4().hex}"
        cart = Cart(session_token=new_token)
        db.add(cart)
        db.commit()
        db.refresh(cart)
        return cart

    @staticmethod
    def add_to_cart(
        db: Session,
        cart: Cart,
        data: CartItemAdd
    ) -> CartResponse:
        variant = db.query(ProductVariant).filter(
            ProductVariant.id == data.variant_id,
            ProductVariant.is_active == True
        ).first()

        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected garment size/color is no longer available.",
            )

        if variant.stock_quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Garment {variant.color_name} / {variant.size} is currently out of stock.",
            )

        cart_item = db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.variant_id == variant.id
        ).first()

        new_quantity = (cart_item.quantity + data.quantity) if cart_item else data.quantity

        if new_quantity > variant.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {variant.stock_quantity} item(s) available in stock for size {variant.size}.",
            )

        if cart_item:
            cart_item.quantity = new_quantity
        else:
            cart_item = CartItem(
                cart_id=cart.id,
                variant_id=variant.id,
                quantity=new_quantity,
            )
            db.add(cart_item)

        cart.updated_at = datetime.now(timezone.utc)
        db.commit()
        return CartService.build_cart_response(db, cart)

    @staticmethod
    def update_cart_item(
        db: Session,
        cart: Cart,
        item_id: str,
        data: CartItemUpdate
    ) -> CartResponse:
        cart_item = db.query(CartItem).filter(
            CartItem.id == item_id,
            CartItem.cart_id == cart.id
        ).first()

        if not cart_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found in shopping cart.",
            )

        variant = db.query(ProductVariant).filter(ProductVariant.id == cart_item.variant_id).first()
        if not variant:
            db.delete(cart_item)
            db.commit()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant unavailable.")

        if data.quantity > variant.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {variant.stock_quantity} available in stock.",
            )

        cart_item.quantity = data.quantity
        cart.updated_at = datetime.now(timezone.utc)
        db.commit()
        return CartService.build_cart_response(db, cart)

    @staticmethod
    def remove_cart_item(db: Session, cart: Cart, item_id: str) -> CartResponse:
        cart_item = db.query(CartItem).filter(
            CartItem.id == item_id,
            CartItem.cart_id == cart.id
        ).first()

        if cart_item:
            db.delete(cart_item)
            cart.updated_at = datetime.now(timezone.utc)
            db.commit()

        return CartService.build_cart_response(db, cart)

    @staticmethod
    def clear_cart(db: Session, cart: Cart) -> CartResponse:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        cart.updated_at = datetime.now(timezone.utc)
        db.commit()
        return CartService.build_cart_response(db, cart)

    @staticmethod
    def merge_guest_cart(db: Session, user: User, session_token: str) -> Cart:
        guest_cart = db.query(Cart).filter(Cart.session_token == session_token).first()
        user_cart = CartService.get_or_create_cart(db, user=user)

        if not guest_cart or not guest_cart.items:
            return user_cart

        for guest_item in guest_cart.items:
            variant = db.query(ProductVariant).filter(
                ProductVariant.id == guest_item.variant_id,
                ProductVariant.is_active == True
            ).first()

            if not variant or variant.stock_quantity <= 0:
                continue

            existing_user_item = db.query(CartItem).filter(
                CartItem.cart_id == user_cart.id,
                CartItem.variant_id == guest_item.variant_id
            ).first()

            if existing_user_item:
                merged_qty = min(existing_user_item.quantity + guest_item.quantity, variant.stock_quantity)
                existing_user_item.quantity = merged_qty
            else:
                db.add(CartItem(
                    cart_id=user_cart.id,
                    variant_id=guest_item.variant_id,
                    quantity=min(guest_item.quantity, variant.stock_quantity),
                ))

        # Delete guest cart after merging
        db.delete(guest_cart)
        db.commit()
        db.refresh(user_cart)
        return user_cart

    @staticmethod
    def build_cart_response(
        db: Session,
        cart: Cart,
        coupon_code: Optional[str] = None
    ) -> CartResponse:
        cart_items = db.query(CartItem).filter(CartItem.cart_id == cart.id).all()

        details: List[CartItemDetail] = []
        subtotal = 0.0

        for item in cart_items:
            variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
            if not variant:
                continue

            product = db.query(Product).filter(Product.id == variant.product_id).first()
            if not product:
                continue

            # Effective price on the server: variant price_override or product sale_price / base_price
            if variant.price_override is not None:
                unit_price = float(variant.price_override)
            elif product.sale_price is not None:
                unit_price = float(product.sale_price)
            else:
                unit_price = float(product.base_price)

            total_item_price = round(unit_price * item.quantity, 2)
            subtotal += total_item_price

            # Get variant specific image or product primary image
            img = db.query(ProductImage.image_url).filter(
                ProductImage.variant_id == variant.id
            ).first()
            if not img:
                img = db.query(ProductImage.image_url).filter(
                    ProductImage.product_id == product.id,
                    ProductImage.is_primary == True
                ).first()
            if not img:
                img = db.query(ProductImage.image_url).filter(
                    ProductImage.product_id == product.id
                ).first()

            image_url = img[0] if img else None

            details.append(CartItemDetail(
                id=item.id,
                variant_id=variant.id,
                product_id=product.id,
                product_title=product.title,
                product_slug=product.slug,
                size=variant.size,
                color_name=variant.color_name,
                color_hex=variant.color_hex,
                sku=variant.sku,
                unit_price=unit_price,
                quantity=item.quantity,
                total_price=total_item_price,
                stock_quantity=variant.stock_quantity,
                image_url=image_url,
            ))

        subtotal = round(subtotal, 2)

        # Retrieve configurable business settings from PostgreSQL
        from app.services.settings_service import SettingsService
        from app.services.subscription_service import SubscriptionService

        gst_rate = SettingsService.get_float_setting(db, "gst_rate", 18.0)
        free_shipping_threshold = SettingsService.get_float_setting(db, "free_shipping_threshold", 1499.0)
        standard_shipping_fee = SettingsService.get_float_setting(db, "standard_shipping_fee", 79.0)
        admin_discount_percent = SettingsService.get_float_setting(db, "admin_global_discount", 0.0)

        # Check Premium Membership status (VIP members get free express delivery on all orders)
        is_premium_member = SubscriptionService.is_user_premium_member(db, cart.user_id)

        # Coupon calculations
        coupon_discount = 0.0
        applied_coupon_code = None
        if coupon_code and subtotal > 0:
            coupon = db.query(Coupon).filter(
                Coupon.code == coupon_code.strip().upper(),
                Coupon.is_active == True
            ).first()
            if coupon:
                now = datetime.now(timezone.utc)
                if (not coupon.valid_to or coupon.valid_to >= now) and subtotal >= float(coupon.min_order_value):
                    if coupon.discount_type == DiscountType.PERCENTAGE:
                        raw_discount = (subtotal * float(coupon.discount_value)) / 100.0
                        if coupon.max_discount:
                            raw_discount = min(raw_discount, float(coupon.max_discount))
                        coupon_discount = round(raw_discount, 2)
                    else:
                        coupon_discount = min(float(coupon.discount_value), subtotal)
                    applied_coupon_code = coupon.code

        # Admin Slider Global Discount (e.g. 10%, 20%, up to 70% storewide promotion)
        admin_discount = 0.0
        if admin_discount_percent > 0.0 and subtotal > 0:
            admin_discount = round((subtotal * admin_discount_percent) / 100.0, 2)

        total_discount = min(subtotal, round(coupon_discount + admin_discount, 2))
        taxable_subtotal = max(0.0, round(subtotal - total_discount, 2))

        # Configurable Shipping Rules:
        # 1. Cart subtotal is 0 -> 0 shipping
        # 2. Premium members receive FREE delivery regardless of cart subtotal
        # 3. Subtotal >= free_shipping_threshold (default ₹1,499) -> FREE delivery
        # 4. Otherwise standard shipping fee (default ₹79)
        if subtotal == 0:
            shipping_fee = 0.0
        elif is_premium_member or subtotal >= free_shipping_threshold:
            shipping_fee = 0.0
        else:
            shipping_fee = standard_shipping_fee

        # Accurate 18% GST calculation on taxable merchandise subtotal
        tax_amount = round((taxable_subtotal * gst_rate) / 100.0, 2)

        # Total payable amount
        total_amount = round(taxable_subtotal + shipping_fee + tax_amount, 2)

        return CartResponse(
            id=cart.id,
            user_id=cart.user_id,
            session_token=cart.session_token,
            items=details,
            item_count=sum(d.quantity for d in details),
            subtotal=subtotal,
            discount_amount=total_discount,
            coupon_code=applied_coupon_code,
            shipping_fee=shipping_fee,
            shipping_threshold=free_shipping_threshold,
            is_free_shipping=(shipping_fee == 0.0 and subtotal > 0),
            tax_amount=tax_amount,
            tax_rate=gst_rate,
            admin_discount_percent=admin_discount_percent,
            total_amount=total_amount,
        )
