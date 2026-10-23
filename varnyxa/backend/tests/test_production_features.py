import pytest
import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.catalog import Product, ProductVariant, Gender, AgeGroup, Category
from app.models.order import Order, OrderStatus, Payment, PaymentStatus, PaymentProvider
from app.models.newsletter import NewsletterSubscriber
from app.services.payyantra_service import PayYantraService
from app.core.security import get_password_hash

client = TestClient(app)


@pytest.fixture(scope="module")
def admin_auth():
    db = SessionLocal()
    admin_email = "prod_admin_test@varnyxa.com"
    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        user = User(
            email=admin_email,
            password_hash=get_password_hash("AdminPass2026!"),
            full_name="Prod Admin Tester",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()

    res = client.post("/api/auth/login", json={"email": admin_email, "password": "AdminPass2026!"})
    assert res.status_code == 200
    return {"token": res.json()["access_token"], "user_id": user.id}


@pytest.fixture(scope="module")
def customer_auth():
    db = SessionLocal()
    customer_email = "prod_customer_test@varnyxa.com"
    user = db.query(User).filter(User.email == customer_email).first()
    if not user:
        user = User(
            email=customer_email,
            password_hash=get_password_hash("CustomerPass2026!"),
            full_name="Prod Customer Tester",
            role=UserRole.CUSTOMER,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()

    res = client.post("/api/auth/login", json={"email": customer_email, "password": "CustomerPass2026!"})
    assert res.status_code == 200
    return {"token": res.json()["access_token"], "user_id": user.id}


# ==============================================================================
# FEATURE 1: Newsletter Subscription Tests
# ==============================================================================

def test_newsletter_subscribe_consent_and_duplicate_handling(admin_auth):
    test_email = f"subscriber_{uuid.uuid4().hex[:8]}@varnyxa-club.com"

    # 1. Invalid email rejected
    res_bad = client.post("/api/newsletter/subscribe", json={"email": "not-an-email", "consent": True})
    assert res_bad.status_code == 422 or res_bad.status_code == 400

    # 2. Subscribe with explicit consent
    res = client.post("/api/newsletter/subscribe", json={
        "email": test_email,
        "consent": True,
        "source": "homepage_test"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["email"] == test_email
    assert data["is_new_subscriber"] is True
    assert data["status"] == "active"
    # When SMTP is not configured, email_dispatched must be False (no fake sent emails)
    assert data["email_dispatched"] is False

    # Verify directly in PostgreSQL
    db = SessionLocal()
    subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == test_email).first()
    assert subscriber is not None
    assert subscriber.consent_at is not None
    assert subscriber.status == "active"
    assert subscriber.unsubscribe_token is not None
    token = subscriber.unsubscribe_token
    db.close()

    # 3. Duplicate request is idempotent and does not create a duplicate row
    res_dup = client.post("/api/newsletter/subscribe", json={
        "email": test_email,
        "consent": True,
        "source": "homepage_test"
    })
    assert res_dup.status_code in [200, 201]
    dup_data = res_dup.json()
    assert dup_data["is_new_subscriber"] is False
    assert "already an active member" in dup_data["message"]

    # 4. Status endpoint check
    res_status = client.get(f"/api/newsletter/status?email={test_email}")
    assert res_status.status_code == 200
    assert res_status.json()["is_subscribed"] is True

    # 5. Tokenized Unsubscribe info check
    res_info = client.get(f"/api/newsletter/unsubscribe-info?token={token}")
    assert res_info.status_code == 200
    assert "masked_email" in res_info.json()
    assert res_info.json()["status"] == "active"

    # 6. Unsubscribe action
    res_unsub = client.post("/api/newsletter/unsubscribe", json={
        "token": token,
        "reason": "too_frequent"
    })
    assert res_unsub.status_code == 200
    assert res_unsub.json()["success"] is True

    db = SessionLocal()
    subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == test_email).first()
    assert subscriber.status == "unsubscribed"
    assert subscriber.unsubscribed_at is not None
    db.close()

    # 7. Re-subscribing reactivates the subscriber safely
    res_reactivate = client.post("/api/newsletter/subscribe", json={
        "email": test_email,
        "consent": True,
        "source": "homepage_reactivate"
    })
    assert res_reactivate.status_code in [200, 201]
    assert "welcome back" in res_reactivate.json()["message"].lower() or "reactivated" in res_reactivate.json()["message"].lower()

    db = SessionLocal()
    subscriber = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == test_email).first()
    assert subscriber.status == "active"
    assert subscriber.unsubscribed_at is None
    db.close()


def test_newsletter_admin_dashboard_and_export(admin_auth, customer_auth):
    # 1. Unauthenticated or Customer access is denied
    res_anon = client.get("/api/admin/newsletter/subscribers")
    assert res_anon.status_code in [401, 403]

    res_cust = client.get(
        "/api/admin/newsletter/subscribers",
        headers={"Authorization": f"Bearer {customer_auth['token']}"}
    )
    assert res_cust.status_code == 403

    # 2. Admin access is permitted with search and filter
    res_admin = client.get(
        "/api/admin/newsletter/subscribers?limit=10",
        headers={"Authorization": f"Bearer {admin_auth['token']}"}
    )
    assert res_admin.status_code == 200
    admin_data = res_admin.json()
    assert "items" in admin_data
    assert "total" in admin_data
    assert "active_count" in admin_data
    assert "unsubscribed_count" in admin_data

    # 3. Admin CSV export
    res_export = client.get(
        "/api/admin/newsletter/export",
        headers={"Authorization": f"Bearer {admin_auth['token']}"}
    )
    assert res_export.status_code == 200
    assert "text/csv" in res_export.headers.get("content-type", "")
    assert "Email" in res_export.text


# ==============================================================================
# FEATURE 2: Seamless Custom Payment Checkout Tests
# ==============================================================================

def test_payyantra_checkout_methods_and_reconciliation(customer_auth):
    db = SessionLocal()
    # Create an order to pay for
    order = Order(
        order_number=f"ORD-PY-{uuid.uuid4().hex[:6].upper()}",
        user_id=customer_auth["user_id"],
        status=OrderStatus.PENDING,
        subtotal=Decimal("1999.00"),
        discount_amount=Decimal("0.00"),
        shipping_fee=Decimal("79.00"),
        tax_amount=Decimal("359.82"),
        total_amount=Decimal("2437.82"),
        currency="INR",
        shipping_address={"full_name": "Test Customer", "city": "Bengaluru"},
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    order_id = order.id
    db.close()

    # 1. Checkout with method 'UPI'
    py_mock_order_id = f"PYOR_UPI_{uuid.uuid4().hex[:8]}"
    mock_order_api_resp = MagicMock()
    mock_order_api_resp.status_code = 201
    mock_order_api_resp.json.return_value = {
        "statusCode": 201,
        "data": {
            "orderId": py_mock_order_id,
            "transactionId": f"PYTR_TXN_{uuid.uuid4().hex[:8]}",
            "transactionPublicId": "3f2a9c1e-0000-0000-0000-000000000000",
            "referenceId": f"INV-{order.order_number}",
            "checkoutUrl": "https://payin-api-uat.payyantra.com/api/public/pay/checkout/v3/3f2a9c1e?method=UPI",
            "status": "INITIATED",
            "amount": float(order.total_amount),
            "currency": "INR",
            "merchantOrderId": f"ORD-{order.order_number}",
            "checkoutVersion": "v3",
            "qrData": "upi://pay?pa=payyantra@icici&pn=VARNYXA&am=2437.82",
            "upiIntentUrl": "upi://pay?pa=payyantra@icici&pn=VARNYXA&am=2437.82",
        },
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_order_api_resp

    with patch.object(PayYantraService, "get_auth_token", return_value="valid_mock_token"):
        with patch("app.services.payyantra_service.httpx.Client", return_value=mock_client):
            res_upi = client.post(
                "/api/payments/payyantra/checkout",
                headers={"Authorization": f"Bearer {customer_auth['token']}"},
                json={"order_id": order_id, "payment_method": "UPI"}
            )
            assert res_upi.status_code == 200, res_upi.text
            upi_data = res_upi.json()
            assert upi_data["payment_method"] == "UPI"
            assert upi_data["qr_data"] is not None
            assert "upi://pay" in upi_data["qr_data"]

            # Verify Payment record in PostgreSQL
            db = SessionLocal()
            payment = db.query(Payment).filter(Payment.order_id == order_id).first()
            assert payment is not None
            assert payment.payment_method == "UPI"
            assert payment.payyantra_order_id == py_mock_order_id
            db.close()

    # 2. Checkout with method 'CARD'
    py_mock_card_id = f"PYOR_CARD_{uuid.uuid4().hex[:8]}"
    mock_card_api_resp = MagicMock()
    mock_card_api_resp.status_code = 201
    mock_card_api_resp.json.return_value = {
        "statusCode": 201,
        "data": {
            "orderId": py_mock_card_id,
            "transactionId": f"PYTR_TXN_{uuid.uuid4().hex[:8]}",
            "transactionPublicId": "card-public-id-12345",
            "referenceId": f"INV-{order.order_number}",
            "checkoutUrl": "https://payin-api-uat.payyantra.com/api/public/pay/checkout/v3/card-session",
            "status": "INITIATED",
            "amount": float(order.total_amount),
            "currency": "INR",
            "merchantOrderId": f"ORD-{order.order_number}",
            "checkoutVersion": "v3",
        },
    }

    mock_card_client = MagicMock()
    mock_card_client.__enter__.return_value = mock_card_client
    mock_card_client.post.return_value = mock_card_api_resp

    with patch.object(PayYantraService, "get_auth_token", return_value="valid_mock_token"):
        with patch("app.services.payyantra_service.httpx.Client", return_value=mock_card_client):
            res_card = client.post(
                "/api/payments/payyantra/checkout",
                headers={"Authorization": f"Bearer {customer_auth['token']}"},
                json={"order_id": order_id, "payment_method": "CARD"}
            )
            assert res_card.status_code == 200
            card_data = res_card.json()
            assert card_data["payment_method"] == "CARD"
            assert "card-session" in card_data["checkout_url"]

    # 3. Customer attempting COD order directly must be rejected by backend
    res_cod = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {customer_auth['token']}"},
        json={
            "shipping_address": {"full_name": "Test Customer", "city": "Mumbai", "address_line1": "Marine Drive"},
            "payment_provider": "cod"
        }
    )
    assert res_cod.status_code == 403
    assert "strictly restricted to administrator" in res_cod.json()["detail"].lower()
