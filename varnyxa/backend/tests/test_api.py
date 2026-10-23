import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.catalog import Product, ProductVariant
from app.models.coupon import Coupon

client = TestClient(app)


def test_health_and_database_connectivity():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["app"] == "VARNYXA"


def test_user_registration_and_duplicate_rejection():
    email = "testcustomer_antigravity@varnyxa.com"
    # Cleanup if previously created
    db = SessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    payload = {
        "email": email,
        "password": "SecurePassword123!",
        "full_name": "Antigravity Test Customer",
        "phone": "+919876543210",
        "agree_terms": True,
    }
    # Successful Registration
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == email

    # Duplicate Registration Rejection
    res_dup = client.post("/api/auth/register", json=payload)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()


def test_user_login_and_invalid_credentials():
    email = "testcustomer_antigravity@varnyxa.com"
    # Valid login
    res = client.post("/api/auth/login", json={"email": email, "password": "SecurePassword123!"})
    assert res.status_code == 200
    assert "access_token" in res.json()

    # Invalid password
    res_bad = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword"})
    assert res_bad.status_code == 401
    assert "invalid" in res_bad.json()["detail"].lower()


def test_protected_routes_and_me():
    # Ensure client cookies are cleared for unauthorized check
    client.cookies.clear()
    res_unauth = client.get("/api/auth/me")
    assert res_unauth.status_code == 401

    # Authorized attempt
    res_login = client.post("/api/auth/login", json={"email": "testcustomer_antigravity@varnyxa.com", "password": "SecurePassword123!"})
    token = res_login.json()["access_token"]

    res_auth = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_auth.status_code == 200
    assert res_auth.json()["email"] == "testcustomer_antigravity@varnyxa.com"


def test_product_catalog_filters_and_sorting():
    # Get all products
    res = client.get("/api/products")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 12
    assert len(data["items"]) > 0

    # Filter by gender = men
    res_men = client.get("/api/products?gender=men")
    assert res_men.status_code == 200
    for item in res_men.json()["items"]:
        assert item["gender"] == "men"

    # Sorting by price_asc
    res_sort = client.get("/api/products?sort=price_asc")
    assert res_sort.status_code == 200
    items = res_sort.json()["items"]
    prices = [p["sale_price"] or p["base_price"] for p in items]
    assert prices == sorted(prices)


def test_product_detail_slug():
    slug = "italian-double-breasted-camel-wool-overcoat"
    res = client.get(f"/api/products/slug/{slug}")
    assert res.status_code == 200
    prod = res.json()
    assert prod["slug"] == slug
    assert len(prod["variants"]) > 0
    assert len(prod["images"]) > 0
    assert prod["category"]["slug"] == "outerwear-coats"


def test_cart_operations_and_calculations():
    db = SessionLocal()
    variant = db.query(ProductVariant).filter(ProductVariant.stock_quantity > 5).first()
    db.close()
    assert variant is not None

    session_token = "test_cart_session_123"
    headers = {"X-Session-Token": session_token}

    # Add to cart
    res_add = client.post("/api/cart/items", json={"variant_id": variant.id, "quantity": 1}, headers=headers)
    assert res_add.status_code == 200
    cart_data = res_add.json()
    assert cart_data["item_count"] == 1
    assert cart_data["subtotal"] > 0
    assert cart_data["total_amount"] >= cart_data["subtotal"]

    # Update item
    item_id = cart_data["items"][0]["id"]
    res_up = client.put(f"/api/cart/items/{item_id}", json={"quantity": 2}, headers=headers)
    assert res_up.status_code == 200
    assert res_up.json()["item_count"] == 2

    # Clear cart
    res_clear = client.delete("/api/cart", headers=headers)
    assert res_clear.status_code == 200
    assert res_clear.json()["item_count"] == 0


def test_coupon_validation():
    # Valid coupon
    res_valid = client.post("/api/coupons/validate", json={"code": "WELCOME500", "subtotal": 2500.0})
    assert res_valid.status_code == 200
    assert res_valid.json()["valid"] is True
    assert res_valid.json()["discount_amount"] == 500.0

    # Coupon below minimum order value
    res_low = client.post("/api/coupons/validate", json={"code": "WELCOME500", "subtotal": 1000.0})
    assert res_low.status_code == 400

    # Invalid coupon
    res_fake = client.post("/api/coupons/validate", json={"code": "NONEXISTENT", "subtotal": 5000.0})
    assert res_fake.status_code == 404


def test_admin_authorization_and_metrics():
    # Customer trying to access admin metrics -> 403
    res_login_cust = client.post("/api/auth/login", json={"email": "testcustomer_antigravity@varnyxa.com", "password": "SecurePassword123!"})
    cust_token = res_login_cust.json()["access_token"]

    res_cust_admin = client.get("/api/admin/metrics", headers={"Authorization": f"Bearer {cust_token}"})
    assert res_cust_admin.status_code == 403

    # Admin accessing metrics -> 200
    res_login_adm = client.post("/api/auth/login", json={"email": "admin@varnyxa.com", "password": "Admin@Varnyxa2026"})
    adm_token = res_login_adm.json()["access_token"]

    res_metrics = client.get("/api/admin/metrics", headers={"Authorization": f"Bearer {adm_token}"})
    assert res_metrics.status_code == 200
    data = res_metrics.json()
    assert "total_products" in data
    assert data["total_products"] >= 12


def test_dynamic_price_bounds_and_catalog_filtering():
    # 1. Price Bounds Endpoint
    res = client.get("/api/products/price-bounds")
    assert res.status_code == 200
    bounds = res.json()
    assert bounds["min_price"] == 150.0
    assert bounds["max_price"] >= 50000.0
    assert bounds["catalog_min_price"] >= 150.0
    assert bounds["catalog_max_price"] >= 50000.0
    
    presets = bounds["preset_counts"]
    assert "under_500" in presets
    assert presets["under_500"] >= 1, "Must have valid products priced under ₹500"
    assert presets["5000_above"] >= 1, "Must have valid products priced ₹5000 & above including >₹50,000"

    # 2. Filter products under ₹500 (₹150 to ₹499)
    res_under_500 = client.get("/api/products?min_price=150&max_price=499")
    assert res_under_500.status_code == 200
    under_500_data = res_under_500.json()
    assert under_500_data["total"] >= 1
    for item in under_500_data["items"]:
        price = item["sale_price"] if item["sale_price"] is not None else item["base_price"]
        assert 150 <= price < 500, f"Product {item['title']} price {price} is not within 150-499"

    # 3. Filter ultra-luxury products over ₹50,000
    res_luxury = client.get("/api/products?min_price=50000")
    assert res_luxury.status_code == 200
    luxury_data = res_luxury.json()
    assert luxury_data["total"] >= 1
    for item in luxury_data["items"]:
        price = item["sale_price"] if item["sale_price"] is not None else item["base_price"]
        assert price >= 50000, f"Product {item['title']} price {price} should be >= 50,000"

