import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.catalog import Product, ProductVariant, Gender, AgeGroup
from app.models.order import Order
from app.models.settings import StoreSetting, AdminDiscountLog
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.services.settings_service import SettingsService
from app.services.subscription_service import SubscriptionService
from app.core.security import get_password_hash

client = TestClient(app)


@pytest.fixture(scope="module")
def admin_token():
    db = SessionLocal()
    admin_email = "admin_test_features@varnyxa.com"
    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        user = User(
            email=admin_email,
            password_hash=get_password_hash("AdminSecretPass123!"),
            full_name="Test Super Admin",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()

    res = client.post("/api/auth/login", json={"email": admin_email, "password": "AdminSecretPass123!"})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    db = SessionLocal()
    customer_email = "customer_test_features@varnyxa.com"
    user = db.query(User).filter(User.email == customer_email).first()
    if not user:
        user = User(
            email=customer_email,
            password_hash=get_password_hash("CustomerPass123!"),
            full_name="Test Regular Customer",
            role=UserRole.CUSTOMER,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()

    res = client.post("/api/auth/login", json={"email": customer_email, "password": "CustomerPass123!"})
    assert res.status_code == 200
    return res.json()["access_token"]


# =========================================================================
# Feature 2: Strict Gender-Based Product Filtering Tests
# =========================================================================

def test_strict_gender_filtering():
    """Verify that filtering by gender returns strictly only that gender's garments."""
    # Test men section
    res_men = client.get("/api/products?gender=men&page_size=50")
    assert res_men.status_code == 200
    items_men = res_men.json()["items"]
    assert len(items_men) > 0
    for p in items_men:
        assert p["gender"] == "men", f"Expected men's garment only, got {p['gender']} for {p['title']}"

    # Test women section
    res_women = client.get("/api/products?gender=women&page_size=50")
    assert res_women.status_code == 200
    items_women = res_women.json()["items"]
    assert len(items_women) > 0
    for p in items_women:
        assert p["gender"] == "women", f"Expected women's garment only, got {p['gender']} for {p['title']}"

    # Test unisex section
    res_unisex = client.get("/api/products?gender=unisex&page_size=50")
    assert res_unisex.status_code == 200
    items_unisex = res_unisex.json()["items"]
    for p in items_unisex:
        assert p["gender"] == "unisex", f"Expected unisex garment only, got {p['gender']} for {p['title']}"


def test_gender_search_queries_do_not_leak():
    """Verify searching for 'men' does not return unisex or women's clothing."""
    res = client.get("/api/products?search=men")
    assert res.status_code == 200
    items = res.json()["items"]
    for p in items:
        # Men search token should not leak women's clothing
        assert p["gender"] != "women", f"Women garment leaked in 'men' query: {p['title']}"


# =========================================================================
# Feature 3 & 4: Accurate 18% GST Billing and Configurable Delivery Fee
# =========================================================================

def test_public_store_settings():
    """Verify public settings endpoint returns default 18% GST and ₹79 shipping rules."""
    res = client.get("/api/settings/public")
    assert res.status_code == 200
    data = res.json()
    assert data["gst_rate"] == 18.0
    assert data["standard_shipping_fee"] == 79.0
    assert data["free_shipping_threshold"] == 1499.0
    assert data["currency"] == "INR"


def test_cart_tax_and_shipping_rules():
    """Test cart calculation with subtotal under ₹1499 and over ₹1499."""
    guest_headers = {"X-Guest-Session": f"test_guest_{uuid.uuid4().hex[:8]}"}

    # Find a product variant to add
    db = SessionLocal()
    variant = db.query(ProductVariant).filter(ProductVariant.stock_quantity > 5).first()
    assert variant is not None, "Need at least one in-stock variant"
    db.close()

    # Add item to cart
    res = client.post(
        "/api/cart/items",
        json={"variant_id": str(variant.id), "quantity": 1},
        headers=guest_headers,
    )
    assert res.status_code == 200
    cart_data = res.json()

    # Verify 18% GST is applied
    assert cart_data["tax_rate"] == 18.0
    expected_tax = round(float(cart_data["subtotal"] - cart_data["discount_amount"]) * 0.18, 2)
    assert abs(cart_data["tax_amount"] - expected_tax) <= 0.05

    # Verify shipping fee rules
    if cart_data["subtotal"] < 1499.0:
        assert cart_data["shipping_fee"] == 79.0
        assert cart_data["is_free_shipping"] is False
    else:
        assert cart_data["shipping_fee"] == 0.0
        assert cart_data["is_free_shipping"] is True

    # Total amount check
    expected_total = round(
        cart_data["subtotal"] - cart_data["discount_amount"] + cart_data["shipping_fee"] + cart_data["tax_amount"],
        2,
    )
    assert abs(cart_data["total_amount"] - expected_total) <= 0.05


# =========================================================================
# Feature 5 & 6: Unique Order ID & Payment Reference ID
# =========================================================================

def test_order_creation_generates_distinct_order_and_reference_ids(customer_token):
    """Verify Order creation assigns human-readable order_number AND unique payment_reference_id."""
    headers = {"Authorization": f"Bearer {customer_token}"}

    # Add item to customer cart first
    db = SessionLocal()
    variant = db.query(ProductVariant).filter(ProductVariant.stock_quantity > 5).first()
    db.close()

    client.post(
        "/api/cart/items",
        json={"variant_id": str(variant.id), "quantity": 1},
        headers=headers,
    )

    # Place an order with inline address
    payload = {
        "payment_provider": "payyantra",
        "shipping_address": {
            "full_name": "Test Customer",
            "phone": "+919876543210",
            "address_line1": "123 Fashion Atelier Way",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postal_code": "400001",
            "country": "India",
        },
    }

    res = client.post("/api/orders", json=payload, headers=headers)
    assert res.status_code == 201
    order = res.json()

    # Verify distinct identifiers
    assert order["order_number"].startswith("VNX-")
    assert order["payment_reference_id"] is not None
    assert order["payment_reference_id"].startswith("PAYREF-")
    assert order["order_number"] != order["payment_reference_id"]

    # Verify snapshot fields
    assert order["tax_rate"] == 18.0
    assert order["shipping_threshold"] == 1499.0

    # Test My Orders retrieval
    res_list = client.get("/api/orders", headers=headers)
    assert res_list.status_code == 200
    my_orders = res_list.json()
    order_ids = [o["id"] for o in my_orders]
    assert order["id"] in order_ids


# =========================================================================
# Feature 7: VARNYXA Premium Membership Subscriptions
# =========================================================================

def test_subscription_plans_and_activation(customer_token):
    """Verify subscription plans retrieval, purchase flow, and VIP benefits."""
    headers = {"Authorization": f"Bearer {customer_token}"}

    # Get plans
    res = client.get("/api/subscriptions/plans")
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) >= 3
    plan_codes = [p["code"] for p in plans]
    assert "monthly" in plan_codes
    assert "quarterly" in plan_codes
    assert "annual" in plan_codes

    # Subscribe to monthly plan
    monthly_plan = next(p for p in plans if p["code"] == "monthly")
    res_sub = client.post(
        "/api/subscriptions/subscribe",
        json={"plan_id": monthly_plan["id"], "payment_method": "payyantra", "direct_activate": True},
        headers=headers,
    )
    assert res_sub.status_code == 200
    sub_data = res_sub.json()
    assert "subscription" in sub_data
    sub = sub_data["subscription"]
    assert sub["is_active"] is True
    assert sub["plan_code"] == "monthly"
    assert sub["payment_reference"].startswith("SUBREF-")

    # Check status endpoint
    res_me = client.get("/api/subscriptions/me", headers=headers)
    assert res_me.status_code == 200
    my_sub = res_me.json()
    assert my_sub["has_active_subscription"] is True
    assert my_sub["subscription"]["days_remaining"] > 0


# =========================================================================
# Feature 8 & 9: Admin-Controlled Discount Slider & Business Settings
# =========================================================================

def test_admin_discount_slider(admin_token, customer_token):
    """Test authorized discount slider (0%-70%) and RBAC enforcement."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    # Customer cannot change discount slider (403 Forbidden)
    res_unauth = client.post(
        "/api/admin/discount-slider",
        json={"discount_percent": 20.0, "reason": "Unauthorized attempt"},
        headers=customer_headers,
    )
    assert res_unauth.status_code == 403

    # Admin cannot set discount above 70%
    res_invalid = client.post(
        "/api/admin/discount-slider",
        json={"discount_percent": 85.0, "reason": "Too high"},
        headers=admin_headers,
    )
    assert res_invalid.status_code in (400, 422)

    # Admin successfully sets discount to 15%
    res_apply = client.post(
        "/api/admin/discount-slider",
        json={"discount_percent": 15.0, "reason": "Festive Autumn Drop"},
        headers=admin_headers,
    )
    assert res_apply.status_code == 200
    result = res_apply.json()
    assert result["discount_percent"] == 15.0
    assert "admin_test_features" in result["applied_by"]

    # Verify public settings reflects 15% discount
    res_pub = client.get("/api/settings/public")
    assert res_pub.status_code == 200
    assert res_pub.json()["admin_global_discount"] == 15.0

    # Reset discount slider back to 0%
    res_reset = client.post(
        "/api/admin/discount-slider",
        json={"discount_percent": 0.0, "reason": "End of test promo"},
        headers=admin_headers,
    )
    assert res_reset.status_code == 200
    assert res_reset.json()["discount_percent"] == 0.0


def test_admin_business_settings_update(admin_token):
    """Test authorized updating of store business rules (shipping fee, threshold, GST)."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    update_payload = {
        "standard_shipping_fee": 79.0,
        "free_shipping_threshold": 1499.0,
        "gst_rate": 18.0,
        "gst_mode": "exclusive",
        "default_theme": "white",
    }
    res = client.put("/api/admin/settings", json=update_payload, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["standard_shipping_fee"] == 79.0
    assert data["free_shipping_threshold"] == 1499.0
    assert data["gst_rate"] == 18.0


# =========================================================================
# Feature 1 & 2: Subscription Checkout, Polling Worker & Admin Controls
# =========================================================================

def test_subscription_creation_and_activation(customer_token, admin_token):
    """Test full subscription purchase lifecycle, pending state, and verified activation."""
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Fetch available plans
    res_plans = client.get("/api/subscriptions/plans")
    assert res_plans.status_code == 200
    plans = res_plans.json()
    assert len(plans) >= 1
    selected_plan = plans[0]

    # 2. Initiate subscribe flow
    res_sub = client.post(
        "/api/subscriptions/subscribe",
        json={"plan_id": selected_plan["id"], "direct_activate": True},
        headers=customer_headers,
    )
    assert res_sub.status_code == 200
    sub_data = res_sub.json()
    assert sub_data["success"] is True
    sub_id = sub_data["subscription_id"]
    assert sub_id is not None
    assert sub_data["payment_reference"].startswith("SUBREF-")

    # 3. Check /me returns active subscription details
    res_me = client.get("/api/subscriptions/me", headers=customer_headers)
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["has_active_subscription"] is True
    assert me_data["subscription"]["id"] == sub_id
    assert me_data["subscription"]["payment_status"] in ("captured", "active")
    assert me_data["subscription"]["days_remaining"] > 0
    assert len(me_data["subscription"]["benefits"]) > 0

    # 4. Check status lookup
    res_status = client.get(f"/api/subscriptions/status/{sub_id}", headers=customer_headers)
    assert res_status.status_code == 200
    st_data = res_status.json()
    assert st_data["is_active"] is True
    assert st_data["subscription_id"] == sub_id

    # 5. Admin listing
    res_admin_subs = client.get("/api/subscriptions/admin/all", headers=admin_headers)
    assert res_admin_subs.status_code == 200
    subs_list = res_admin_subs.json()
    assert any(s["id"] == sub_id for s in subs_list)

    # 6. Customer cannot access admin subscriptions
    res_cust_forbidden = client.get("/api/subscriptions/admin/all", headers=customer_headers)
    assert res_cust_forbidden.status_code == 403


def test_polling_service_worker_and_admin_controls(admin_token, customer_token):
    """Test polling status retrieval, admin poll-now action, and role security."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    # 1. Admin gets polling status
    res_status = client.get("/api/admin/payments/polling-status", headers=admin_headers)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert "interval_seconds" in status_data
    assert "is_gateway_configured" in status_data
    assert "orders_checked" in status_data

    # 2. Customer cannot access polling status
    res_unauth = client.get("/api/admin/payments/polling-status", headers=customer_headers)
    assert res_unauth.status_code == 403

    # 3. Admin triggers manual poll
    res_poll = client.post("/api/admin/payments/poll-now", headers=admin_headers)
    assert res_poll.status_code == 200
    poll_result = res_poll.json()
    assert poll_result["success"] is True
    assert "reconciler" in poll_result["message"].lower() or "polling" in poll_result["message"].lower()

    # 4. Customer cannot trigger poll
    res_poll_unauth = client.post("/api/admin/payments/poll-now", headers=customer_headers)
    assert res_poll_unauth.status_code == 403


def test_customer_order_tracking_and_security(customer_token, admin_token):
    """Test customer order tracking details and customer privacy isolation."""
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    # 1. Retrieve customer orders
    res_orders = client.get("/api/orders", headers=customer_headers)
    assert res_orders.status_code == 200
    orders = res_orders.json()
    assert isinstance(orders, list)

    if len(orders) > 0:
        o = orders[0]
        assert "order_number" in o
        assert "status" in o
        assert "total_amount" in o
        assert "subtotal" in o
        assert "tax_amount" in o
        assert "shipping_fee" in o
        assert "payments" in o


def test_cod_payment_config_and_settings_isolation(customer_token, admin_token):
    """Test payment config isolation: COD is never exposed to public or regular customers."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    # 1. Anonymous visitor (no auth cookies or headers)
    anon_client = TestClient(app)
    res_anon = anon_client.get("/api/payments/config")
    assert res_anon.status_code == 200
    anon_data = res_anon.json()
    assert anon_data["active_provider"] == "payyantra"
    assert anon_data["admin_cod_available"] is False

    # 2. Authenticated customer
    res_cust = client.get("/api/payments/config", headers=customer_headers)
    assert res_cust.status_code == 200
    cust_data = res_cust.json()
    assert cust_data["active_provider"] == "payyantra"
    assert cust_data["admin_cod_available"] is False

    # 3. Authenticated admin
    res_admin = client.get("/api/payments/config", headers=admin_headers)
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    assert "admin_cod_available" in admin_data
    assert admin_data["admin_cod_available"] is True

    # 4. Public settings do not expose admin_allow_cod
    res_pub_settings = client.get("/api/settings/public")
    assert res_pub_settings.status_code == 200
    assert "admin_allow_cod" not in res_pub_settings.json()

    # 5. Customer forbidden from admin settings
    res_cust_settings = client.get("/api/admin/settings", headers=customer_headers)
    assert res_cust_settings.status_code == 403

    # 6. Admin can retrieve and update admin_allow_cod
    res_admin_settings = client.get("/api/admin/settings", headers=admin_headers)
    assert res_admin_settings.status_code == 200
    assert "admin_allow_cod" in res_admin_settings.json()


def test_customer_cod_order_creation_rejected_by_backend(customer_token):
    """Ensure regular customer cannot bypass frontend and submit COD order through API."""
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    db = SessionLocal()

    # Find a product variant with stock
    variant = db.query(ProductVariant).filter(ProductVariant.stock_quantity > 0, ProductVariant.is_active == True).first()
    assert variant is not None
    db.close()

    # Add item to customer's cart
    client.post("/api/cart/items", json={"variant_id": variant.id, "quantity": 1}, headers=customer_headers)

    # Attempt to place order with payment_provider = "cod"
    cod_order_payload = {
        "shipping_address": {
            "full_name": "Test Customer",
            "phone": "9876543210",
            "address_line1": "123 High Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postal_code": "400001",
            "country": "India",
            "address_type": "Home",
        },
        "payment_provider": "cod",
    }

    res = client.post("/api/orders", json=cod_order_payload, headers=customer_headers)
    assert res.status_code == 403
    assert "strictly restricted to administrator internal operations" in res.json()["detail"]


def test_admin_cod_order_creation_and_setting_toggle(admin_token):
    """Test authorized admin can create COD orders and respect the admin_allow_cod toggle."""
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    db = SessionLocal()

    variant = db.query(ProductVariant).filter(ProductVariant.stock_quantity > 0, ProductVariant.is_active == True).first()
    assert variant is not None
    db.close()

    # 1. Ensure admin_allow_cod is True
    client.put("/api/admin/settings", json={"admin_allow_cod": True}, headers=admin_headers)

    # 2. Admin adds item to cart
    client.post("/api/cart/items", json={"variant_id": variant.id, "quantity": 1}, headers=admin_headers)

    # 3. Admin successfully places COD order
    admin_order_payload = {
        "shipping_address": {
            "full_name": "Admin Tester",
            "phone": "9998887776",
            "address_line1": "456 Atelier Row",
            "city": "New Delhi",
            "state": "Delhi",
            "postal_code": "110001",
            "country": "India",
            "address_type": "Office",
        },
        "payment_provider": "cod",
    }
    res_order = client.post("/api/orders", json=admin_order_payload, headers=admin_headers)
    assert res_order.status_code == 201
    order_data = res_order.json()
    assert order_data["payments"][0]["provider"] == "cod"

    # 4. Admin disables COD via settings toggle
    client.put("/api/admin/settings", json={"admin_allow_cod": False}, headers=admin_headers)

    # 5. Admin adds item to cart again
    client.post("/api/cart/items", json={"variant_id": variant.id, "quantity": 1}, headers=admin_headers)

    # 6. Admin attempts COD order when toggle is disabled -> rejected 403
    res_disabled = client.post("/api/orders", json=admin_order_payload, headers=admin_headers)
    assert res_disabled.status_code == 403
    assert "disabled in store administrative settings" in res_disabled.json()["detail"]

    # 7. Restore toggle to True
    client.put("/api/admin/settings", json={"admin_allow_cod": True}, headers=admin_headers)

