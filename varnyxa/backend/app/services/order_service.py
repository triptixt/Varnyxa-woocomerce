import uuid
import random
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem, Payment, OrderStatus, PaymentProvider, PaymentStatus
from app.models.cart import Cart, CartItem
from app.models.catalog import ProductVariant, Product, ProductImage
from app.models.coupon import Coupon
from app.models.address import Address
from app.models.user import User, UserRole
from app.schemas.order import OrderCreateRequest, OrderResponse, OrderItemResponse, OrderStatusUpdateRequest
from app.services.cart_service import CartService
from app.services.settings_service import SettingsService
from app.core.config import settings


class OrderService:
    @staticmethod
    def generate_order_number() -> str:
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        rand_suffix = f"{random.randint(1000, 9999)}"
        return f"VNX-{now_str}-{rand_suffix}"

    @staticmethod
    def generate_payment_reference_id() -> str:
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        rand_hex = uuid.uuid4().hex[:8].upper()
        return f"PAYREF-{now_str}-{rand_hex}"

    @staticmethod
    def create_order(
        db: Session,
        user: User,
        data: OrderCreateRequest
    ) -> Order:
        # Enforce server-side restriction: Cash on Delivery (COD) is strictly admin-only
        if data.payment_provider == PaymentProvider.COD:
            if user.role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cash on Delivery (COD) is strictly restricted to administrator internal operations. Please select an authorized online payment method.",
                )
            # Check internal admin toggle
            admin_cod_enabled = SettingsService.get_setting(db, "admin_allow_cod", "true").lower() in ("true", "1", "yes")
            if not admin_cod_enabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cash on Delivery is currently disabled in store administrative settings.",
                )

        # Fetch user's cart
        cart = db.query(Cart).filter(Cart.user_id == user.id).first()
        if not cart or not cart.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your shopping cart is empty.",
            )

        # Resolve shipping address snapshot
        shipping_addr_dict: Dict[str, Any] = {}
        if data.address_id:
            addr = db.query(Address).filter(
                Address.id == data.address_id,
                Address.user_id == user.id
            ).first()
            if not addr:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected shipping address not found.")
            shipping_addr_dict = {
                "full_name": addr.full_name,
                "phone": addr.phone,
                "address_line1": addr.address_line1,
                "address_line2": addr.address_line2,
                "city": addr.city,
                "state": addr.state,
                "postal_code": addr.postal_code,
                "country": addr.country,
                "address_type": addr.address_type,
            }
        elif data.shipping_address:
            shipping_addr_dict = data.shipping_address
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid shipping address is required for placing an order.",
            )

        # Server-side cart calculation
        cart_summary = CartService.build_cart_response(db, cart, coupon_code=data.coupon_code)
        if not cart_summary.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart has no valid items.")

        # Atomic inventory verification and reservation
        order_items_to_create = []
        for item in cart_summary.items:
            variant = db.query(ProductVariant).filter(
                ProductVariant.id == item.variant_id
            ).with_for_update().first()

            if not variant or not variant.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Garment '{item.product_title}' ({item.size}) is no longer available.",
                )

            if variant.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient inventory for '{item.product_title}' ({item.size}). Available: {variant.stock_quantity}.",
                )

            # Deduct stock atomically
            variant.stock_quantity -= item.quantity

            order_items_to_create.append(OrderItem(
                product_id=item.product_id,
                variant_id=item.variant_id,
                product_title=item.product_title,
                sku=item.sku,
                size=item.size,
                color_name=item.color_name,
                unit_price=item.unit_price,
                quantity=item.quantity,
                total_price=item.total_price,
                image_url=item.image_url,
            ))

        # Record coupon usage if applied
        if cart_summary.coupon_code:
            coupon = db.query(Coupon).filter(Coupon.code == cart_summary.coupon_code).first()
            if coupon:
                coupon.times_used += 1

        # Generate unique human-readable VARNYXA Order ID and distinct Payment Reference ID
        order_num = OrderService.generate_order_number()
        payment_ref_id = OrderService.generate_payment_reference_id()

        # Create Order record with permanent tax, shipping, and discount snapshot
        new_order = Order(
            order_number=order_num,
            payment_reference_id=payment_ref_id,
            user_id=user.id,
            status=OrderStatus.PLACED,
            subtotal=cart_summary.subtotal,
            discount_amount=cart_summary.discount_amount,
            coupon_code=cart_summary.coupon_code,
            shipping_fee=cart_summary.shipping_fee,
            shipping_threshold=cart_summary.shipping_threshold,
            tax_amount=cart_summary.tax_amount,
            tax_rate=cart_summary.tax_rate,
            total_amount=cart_summary.total_amount,
            currency=settings.STORE_CURRENCY,
            shipping_address=shipping_addr_dict,
        )
        db.add(new_order)
        db.flush()

        for oi in order_items_to_create:
            oi.order_id = new_order.id
            db.add(oi)

        # Initial payment record associated with payment reference ID
        initial_payment_status = PaymentStatus.PENDING
        payment_record = Payment(
            order_id=new_order.id,
            provider=data.payment_provider,
            status=initial_payment_status,
            merchant_order_id=f"ORD-{new_order.order_number}",
            reference_id=payment_ref_id,
            amount=new_order.total_amount,
            currency=settings.STORE_CURRENCY,
        )
        db.add(payment_record)

        # Clear cart upon order creation
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        db.commit()
        db.refresh(new_order)
        return new_order

    @staticmethod
    def get_order_by_id(db: Session, order_id: str, user: Optional[User] = None) -> Order:
        query = db.query(Order).filter(Order.id == order_id)
        if user and user.role.value != "admin":
            query = query.filter(Order.user_id == user.id)
        order = query.first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        return order

    @staticmethod
    def get_order_receipt(db: Session, order_id: str, user: User) -> Dict[str, Any]:
        """
        Generates and returns an official payment receipt for a confirmed order.
        Strictly restricted to the order owner or administrator.
        Fails if payment is still pending, failed, or demo-only.
        """
        order = OrderService.get_order_by_id(db, order_id, user=user)

        # Check for confirmed order status and captured payment
        is_paid = (
            order.status in [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]
            or any(p.status == PaymentStatus.CAPTURED for p in order.payments)
        )

        if not is_paid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An official payment receipt is only available after payment has been verified and captured. Current order status is '{order.status.value}'.",
            )

        # Find the primary captured or confirmed payment
        captured_payment = next(
            (p for p in order.payments if p.status == PaymentStatus.CAPTURED),
            order.payments[0] if order.payments else None,
        )

        payment_provider = captured_payment.provider.value if (captured_payment and hasattr(captured_payment.provider, "value")) else "online"
        payment_method = captured_payment.payment_method if (captured_payment and captured_payment.payment_method) else "Direct Payment"
        payment_ref = (
            order.payment_reference_id
            or (captured_payment.reference_id if captured_payment else None)
            or (captured_payment.razorpay_payment_id if captured_payment else None)
            or (captured_payment.payyantra_order_id if captured_payment else None)
            or f"REF-{order.order_number}"
        )
        verified_date = (
            captured_payment.verified_at
            if (captured_payment and captured_payment.verified_at)
            else order.updated_at
        )

        return {
            "is_valid_receipt": True,
            "receipt_type": "OFFICIAL_TAX_INVOICE",
            "merchant_name": "VARNYXA Couture Pvt. Ltd.",
            "merchant_gstin": "29AABCU9603R1ZM",
            "merchant_support": "concierge@varnyxa.com",
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_reference_id": payment_ref,
            "payment_gateway": payment_provider,
            "payment_method": payment_method,
            "transaction_id": captured_payment.razorpay_payment_id if (captured_payment and captured_payment.razorpay_payment_id) else (captured_payment.payyantra_order_id if captured_payment else None),
            "bank_rrn": captured_payment.rrn if captured_payment else None,
            "payment_status": "PAID",
            "payment_date": verified_date.isoformat() if verified_date else order.created_at.isoformat(),
            "customer_name": order.shipping_address.get("full_name") if order.shipping_address else (user.full_name or "Valued Client"),
            "customer_email": user.email,
            "customer_phone": order.shipping_address.get("phone") if order.shipping_address else user.phone,
            "shipping_address": order.shipping_address,
            "items": [
                {
                    "product_title": item.product_title,
                    "sku": item.sku,
                    "size": item.size,
                    "color_name": item.color_name,
                    "unit_price": float(item.unit_price),
                    "quantity": item.quantity,
                    "total_price": float(item.total_price),
                }
                for item in order.items
            ],
            "subtotal": float(order.subtotal),
            "discount_amount": float(order.discount_amount),
            "coupon_code": order.coupon_code,
            "shipping_fee": float(order.shipping_fee),
            "tax_amount": float(order.tax_amount),
            "tax_rate": float(order.tax_rate),
            "total_amount": float(order.total_amount),
            "currency": order.currency,
        }

    @staticmethod
    def get_user_orders(db: Session, user: User) -> List[Order]:
        return db.query(Order)\
                 .filter(Order.user_id == user.id)\
                 .order_by(desc(Order.created_at))\
                 .all()

    @staticmethod
    def cancel_order(db: Session, order_id: str, user: User, reason: str) -> Order:
        order = OrderService.get_order_by_id(db, order_id, user=user)
        if order.status not in [OrderStatus.PLACED, OrderStatus.CONFIRMED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order cannot be cancelled in status '{order.status.value}'.",
            )

        # Restock inventory
        for item in order.items:
            if item.variant_id:
                variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
                if variant:
                    variant.stock_quantity += item.quantity

        order.status = OrderStatus.CANCELLED
        order.cancellation_reason = reason
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def update_order_status_admin(db: Session, order_id: str, data: OrderStatusUpdateRequest) -> Order:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        order.status = data.status
        if data.tracking_number:
            order.tracking_number = data.tracking_number
        if data.courier_partner:
            order.courier_partner = data.courier_partner
        if data.status == OrderStatus.DELIVERED:
            order.delivered_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(order)
        return order
