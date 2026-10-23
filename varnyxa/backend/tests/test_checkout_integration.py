import hmac
import hashlib
import json
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus, Payment, PaymentProvider, PaymentStatus
from app.models.catalog import Product, ProductVariant, Gender, AgeGroup
from app.models.cart import Cart, CartItem
from app.core.security import get_password_hash
from app.services.payment_service import PaymentService
from app.services.payyantra_service import PayYantraService
from app.schemas.payment import RazorpayVerifyRequest

client = TestClient(app)


@pytest.fixture
def test_setup():
    db = SessionLocal()
    # Create admin
    admin = db.query(User).filter(User.email == "admin_checkout_test@varnyxa.com").first()
    if not admin:
        admin = User(
            email="admin_checkout_test@varnyxa.com",
            password_hash=get_password_hash("AdminPass123!"),
            full_name="Admin Checkout User",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # Create customer
    customer = db.query(User).filter(User.email == "customer_checkout_test@varnyxa.com").first()
    if not customer:
        customer = User(
            email="customer_checkout_test@varnyxa.com",
            password_hash=get_password_hash("CustomerPass123!"),
            full_name="Customer Checkout User",
            role=UserRole.CUSTOMER,
            is_active=True,
            is_verified=True,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    # Login admin
    res_admin = client.post("/api/auth/login", json={"email": admin.email, "password": "AdminPass123!"})
    admin_token = res_admin.json()["access_token"]

    # Login customer
    res_cust = client.post("/api/auth/login", json={"email": customer.email, "password": "CustomerPass123!"})
    customer_token = res_cust.json()["access_token"]

    # Create a test product variant
    product = db.query(Product).first()
    if not product:
        product = Product(
            title="Signature Silk Blouse",
            slug=f"silk-blouse-{customer.id[:8]}",
            base_price=2499.0,
            gender=Gender.WOMEN,
            age_group=AgeGroup.ADULT,
            category="tops",
            is_active=True,
        )
        db.add(product)
        db.commit()
        db.refresh(product)

    variant = db.query(ProductVariant).filter(ProductVariant.product_id == product.id).first()
    if not variant:
        variant = ProductVariant(
            product_id=product.id,
            sku=f"SKU-SILK-{customer.id[:8]}",
            size="M",
            color_name="Crimson",
            price_adjustment=0.0,
            stock_quantity=500,
            is_active=True,
        )
        db.add(variant)
    else:
        variant.stock_quantity = 500
        variant.is_active = True
    db.commit()
    db.refresh(variant)

    db.close()
    return {
        "admin_token": admin_token,
        "customer_token": customer_token,
        "variant_id": variant.id,
    }


def test_customer_cod_order_rejected_server_side(test_setup):
    """Requirement 5: COD checkout requests by regular customers MUST be rejected with HTTP 403."""
    # Add item to customer cart
    headers = {"Authorization": f"Bearer {test_setup['customer_token']}"}
    client.post("/api/cart/items", json={"variant_id": test_setup["variant_id"], "quantity": 1}, headers=headers)

    res = client.post(
        "/api/orders",
        json={
            "payment_provider": "cod",
            "shipping_address": {
                "full_name": "Test Patron",
                "phone": "9876543210",
                "address_line1": "100 MG Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560001",
                "country": "India",
            },
        },
        headers=headers,
    )
    assert res.status_code == 403
    assert "strictly restricted to administrator" in res.json()["detail"]


def test_admin_cod_order_allowed_server_side(test_setup):
    """Requirement 5: Authorized administrators can place COD orders for internal operations."""
    admin_headers = {"Authorization": f"Bearer {test_setup['admin_token']}"}
    client.post("/api/cart/items", json={"variant_id": test_setup["variant_id"], "quantity": 1}, headers=admin_headers)

    res = client.post(
        "/api/orders",
        json={
            "payment_provider": "cod",
            "shipping_address": {
                "full_name": "Store Manager",
                "phone": "9876543210",
                "address_line1": "VARNYXA Atelier HQ",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postal_code": "400001",
                "country": "India",
            },
        },
        headers=admin_headers,
    )
    assert res.status_code == 201
    order_data = res.json()
    assert order_data["status"] == "placed"


def test_customer_generic_payyantra_hosted_checkout_rejected(test_setup):
    """Requirement 2: Generic PayYantra Hosted Checkout is forbidden for customers."""
    headers = {"Authorization": f"Bearer {test_setup['customer_token']}"}
    client.post("/api/cart/items", json={"variant_id": test_setup["variant_id"], "quantity": 1}, headers=headers)
    order_res = client.post(
        "/api/orders",
        json={
            "payment_provider": "payyantra",
            "shipping_address": {
                "full_name": "Customer User",
                "phone": "9876543210",
                "address_line1": "100 MG Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560001",
                "country": "India",
            },
        },
        headers=headers,
    )
    order_id = order_res.json()["id"]

    # Customer attempts generic hosted checkout
    res = client.post(
        "/api/payments/payyantra/checkout",
        json={"order_id": order_id, "payment_method": "HOSTED"},
        headers=headers,
    )
    assert res.status_code == 403
    assert "Generic PayYantra Hosted Checkout is restricted to administrators" in res.json()["detail"]


def test_razorpay_order_creation_distinct_fields_and_methods(test_setup):
    """Requirement 4: Razorpay preserves distinct fields and honours payment_method."""
    db = SessionLocal()
    customer = db.query(User).filter(User.email == "customer_checkout_test@varnyxa.com").first()

    u_id = uuid.uuid4().hex[:8]
    order_num = f"VNX-TEST-RZP-{u_id}"
    payref = f"PAYREF-TEST-RZP-{u_id}"
    rzp_order_id = f"order_mock_rzp_{u_id}"

    order = Order(
        order_number=order_num,
        payment_reference_id=payref,
        user_id=customer.id,
        status=OrderStatus.PLACED,
        subtotal=2499.0,
        total_amount=2499.0,
        currency="INR",
        shipping_address={"full_name": "Customer User"},
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    mock_rp_client = MagicMock()
    mock_rp_client.order.create.return_value = {
        "id": rzp_order_id,
        "amount": 249900,
        "currency": "INR",
        "status": "created",
    }

    with patch("app.core.config.settings.RAZORPAY_KEY_ID", "rzp_test_key_123"):
        with patch("app.core.config.settings.RAZORPAY_KEY_SECRET", "rzp_test_secret_456"):
            with patch.object(PaymentService, "get_razorpay_client", return_value=mock_rp_client):
                res = PaymentService.create_razorpay_order(
                    db=db,
                    order_id=order.id,
                    user=customer,
                    payment_method="card",
                )
                assert res.razorpay_order_id == rzp_order_id
                assert res.amount == 249900
                assert res.currency == "INR"
                assert res.payment_method == "card"

                # Check payment in DB has distinct fields
                payment = db.query(Payment).filter(Payment.order_id == order.id).first()
                assert payment is not None
                assert payment.provider == PaymentProvider.RAZORPAY
                assert payment.razorpay_order_id == rzp_order_id
                assert payment.merchant_order_id == f"ORD-{order_num}"
                assert payment.reference_id == payref
                assert payment.payment_method == "CARD"
    db.close()


def test_razorpay_signature_verification_and_idempotency(test_setup):
    """Requirement 4: Server-side cryptographic HMAC SHA-256 verification and idempotent processing."""
    db = SessionLocal()
    customer = db.query(User).filter(User.email == "customer_checkout_test@varnyxa.com").first()

    u_id = uuid.uuid4().hex[:8]
    order_num = f"VNX-TEST-SIG-{u_id}"
    payref = f"PAYREF-TEST-SIG-{u_id}"
    order_id = f"order_test_sig_{u_id}"
    payment_id = f"pay_test_pmt_{u_id}"

    order = Order(
        order_number=order_num,
        payment_reference_id=payref,
        user_id=customer.id,
        status=OrderStatus.PLACED,
        subtotal=1999.0,
        total_amount=1999.0,
        currency="INR",
        shipping_address={"full_name": "Customer User"},
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    payment = Payment(
        order_id=order.id,
        provider=PaymentProvider.RAZORPAY,
        razorpay_order_id=order_id,
        status=PaymentStatus.PENDING,
        amount=1999.0,
        currency="INR",
    )
    db.add(payment)
    db.commit()

    key_secret = "test_super_secret_rzp_key_789"

    valid_sig = hmac.new(
        key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    invalid_sig = "fake_invalid_signature_hex"

    with patch("app.core.config.settings.RAZORPAY_KEY_ID", "rzp_test_key_123"):
        with patch("app.core.config.settings.RAZORPAY_KEY_SECRET", key_secret):
            # 1. Invalid signature must fail
            with pytest.raises(Exception) as excinfo:
                PaymentService.verify_payment(
                    db=db,
                    data=RazorpayVerifyRequest(
                        order_id=order.id,
                        razorpay_order_id=order_id,
                        razorpay_payment_id=payment_id,
                        razorpay_signature=invalid_sig,
                    ),
                    user=customer,
                )
            assert "Payment signature verification failed" in str(excinfo.value.detail)

            # 2. Valid signature must succeed
            success = PaymentService.verify_payment(
                db=db,
                data=RazorpayVerifyRequest(
                    order_id=order.id,
                    razorpay_order_id=order_id,
                    razorpay_payment_id=payment_id,
                    razorpay_signature=valid_sig,
                ),
                user=customer,
            )
            assert success is True
            db.refresh(order)
            db.refresh(payment)
            assert order.status == OrderStatus.CONFIRMED
            assert payment.status == PaymentStatus.CAPTURED
            assert payment.razorpay_payment_id == payment_id
            assert payment.verified_at is not None

            # 3. Idempotent re-verification must return True without re-executing
            success_again = PaymentService.verify_payment(
                db=db,
                data=RazorpayVerifyRequest(
                    order_id=order.id,
                    razorpay_order_id=order_id,
                    razorpay_payment_id=payment_id,
                    razorpay_signature=valid_sig,
                ),
                user=customer,
            )
            assert success_again is True

    db.close()


def test_razorpay_webhook_event_handling(test_setup):
    """Requirement 4: Webhook handling for captured and failed events with HMAC verification."""
    db = SessionLocal()
    customer = db.query(User).filter(User.email == "customer_checkout_test@varnyxa.com").first()

    u_id = uuid.uuid4().hex[:8]
    order_num = f"VNX-TEST-WBK-{u_id}"
    order_id = f"order_test_wbk_{u_id}"
    payment_id = f"pay_captured_{u_id}"

    order = Order(
        order_number=order_num,
        user_id=customer.id,
        status=OrderStatus.PLACED,
        subtotal=1499.0,
        total_amount=1499.0,
        currency="INR",
        shipping_address={"full_name": "Customer User"},
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    payment = Payment(
        order_id=order.id,
        provider=PaymentProvider.RAZORPAY,
        razorpay_order_id=order_id,
        status=PaymentStatus.PENDING,
        amount=1499.0,
        currency="INR",
    )
    db.add(payment)
    db.commit()

    webhook_secret = "test_webhook_secret_key_abc"
    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "order_id": order_id,
                    "amount": 149900,
                    "status": "captured",
                }
            }
        },
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    valid_sig = hmac.new(webhook_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    with patch("app.core.config.settings.RAZORPAY_WEBHOOK_SECRET", webhook_secret):
        result = PaymentService.process_webhook(db, body_bytes, valid_sig)
        assert result["status"] == "ok"
        assert result["event"] == "payment.captured"

        db.refresh(payment)
        db.refresh(order)
        assert payment.status == PaymentStatus.CAPTURED
        assert payment.razorpay_payment_id == payment_id
        assert order.status == OrderStatus.CONFIRMED

    db.close()


def test_demo_payment_completion_persists_and_updates_order(test_setup):
    """
    Test that completing a demo payment persists DEMO_COMPLETED in the database,
    updates the order to CONFIRMED, and correctly surfaces on GET /api/orders.
    """
    db = SessionLocal()
    customer = db.query(User).filter(User.email == "customer_checkout_test@varnyxa.com").first()
    u_id = uuid.uuid4().hex[:8]
    order_num = f"VNX-DEMO-{u_id}"

    order = Order(
        order_number=order_num,
        user_id=customer.id,
        status=OrderStatus.PLACED,
        subtotal=2999.0,
        total_amount=2999.0,
        currency="INR",
        shipping_address={"full_name": "Demo Buyer", "city": "Mumbai"},
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Initially order is PLACED, no payments or pending
    demo_ref = f"VNX-DEMO-UPI-{u_id}"
    headers = {"Authorization": f"Bearer {test_setup['customer_token']}"}

    res = client.post(
        "/api/payments/demo/complete",
        json={"order_id": order.id, "reference_id": demo_ref},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == order.id
    assert data["status"] == "confirmed"
    assert len(data["payments"]) >= 1
    assert data["payments"][0]["status"] == "demo_completed"
    assert data["payments"][0]["provider"] == "demo"
    assert data["payments"][0]["reference_id"] == demo_ref

    # Verify directly in DB
    db.refresh(order)
    assert order.status == OrderStatus.CONFIRMED
    assert len(order.payments) >= 1
    latest_pmt = order.payments[0]
    assert latest_pmt.provider == PaymentProvider.DEMO
    assert latest_pmt.status == PaymentStatus.DEMO_COMPLETED
    assert latest_pmt.reference_id == demo_ref

    # Verify GET /api/orders returns persisted demo status
    orders_res = client.get("/api/orders", headers=headers)
    assert orders_res.status_code == 200
    user_orders = orders_res.json()
    matched = [o for o in user_orders if o["id"] == order.id]
    assert len(matched) == 1
    found = matched[0]
    assert found["status"] == "confirmed"
    assert len(found["payments"]) >= 1
    assert found["payments"][0]["status"] == "demo_completed"
    assert found["payments"][0]["provider"] == "demo"

    # Verify GET /api/payments/status/{order_id} returns unified status
    status_res = client.get(f"/api/payments/status/{order.id}", headers=headers)
    assert status_res.status_code == 200
    s_data = status_res.json()
    assert s_data["order_id"] == order.id
    assert s_data["order_status"] == "confirmed"
    assert s_data["payment_status"] == "demo_completed"
    assert s_data["is_paid"] is True
    assert s_data["is_demo"] is True

    db.close()


def test_demo_payment_cannot_hijack_other_user_order(test_setup):
    """
    Test that another user cannot trigger demo completion on an order they do not own.
    """
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "admin_checkout_test@varnyxa.com").first()
    u_id = uuid.uuid4().hex[:8]

    # Order owned by admin
    admin_order = Order(
        order_number=f"VNX-ADMIN-{u_id}",
        user_id=admin.id,
        status=OrderStatus.PLACED,
        subtotal=1999.0,
        total_amount=1999.0,
        currency="INR",
        shipping_address={"full_name": "Admin Only"},
    )
    db.add(admin_order)
    db.commit()
    db.refresh(admin_order)

    # Customer tries to complete demo on admin's order
    cust_headers = {"Authorization": f"Bearer {test_setup['customer_token']}"}
    res = client.post(
        "/api/payments/demo/complete",
        json={"order_id": admin_order.id, "demo_reference": "MALICIOUS-ATTEMPT"},
        headers=cust_headers,
    )
    assert res.status_code == 404

    db.close()

