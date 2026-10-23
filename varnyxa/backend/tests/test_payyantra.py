import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.models.order import Order, OrderStatus, Payment, PaymentProvider, PaymentStatus
from app.models.user import User, UserRole
from app.services.payyantra_service import PayYantraService
from app.db.session import SessionLocal

client = TestClient(app)


@pytest.fixture
def auth_headers():
    """Generates an authenticated customer token for testing."""
    reg_data = {
        "email": "payyantra_tester@example.com",
        "password": "Password123!",
        "full_name": "PayYantra Tester",
        "phone": "9876543210",
        "agree_terms": True,
    }
    # Register or login
    client.post("/api/auth/register", json=reg_data)
    login_resp = client.post(
        "/api/auth/login",
        json={"email": reg_data["email"], "password": reg_data["password"]},
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_payment_config_endpoint():
    """Verify public config returns gateway state without leaking secrets."""
    resp = client.get("/api/payments/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "payyantra_configured" in data
    assert "razorpay_configured" in data
    assert "active_provider" in data
    assert "client_secret" not in str(data).lower()
    assert "key_secret" not in str(data).lower()


def test_payyantra_token_acquisition_success():
    """Verify Token API request headers and token caching."""
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "data": {
            "token": "mocked_payyantra_jwt_token_xyz_12345",
            "merchant": {
                "merchant_id": "8d7cd35e-ec8c-42be-9df0-af725468dc82",
                "name": "Demo Merchant Store",
                "status": "ACTIVE",
            },
        },
        "message": "Token generation successful",
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_token_resp

    with patch("app.core.config.settings.PAYYANTRA_CLIENT_ID", "test_client_id"):
        with patch("app.core.config.settings.PAYYANTRA_CLIENT_SECRET", "test_client_secret"):
            with patch("app.services.payyantra_service.httpx.Client", return_value=mock_client):
                # Force refresh token
                token = PayYantraService.get_auth_token(force_refresh=True)
                assert token == "mocked_payyantra_jwt_token_xyz_12345"

                # Verify exact headers from PayYantra OpenAPI spec
                call_args, call_kwargs = mock_client.post.call_args
                headers = call_kwargs.get("headers", {})
                assert headers.get("x-client-id") == "test_client_id"
                assert headers.get("x-client-secret") == "test_client_secret"
                assert headers.get("x-api-version") == "2024-01-01"


def test_payyantra_token_unauthorized_rejection():
    """Verify Token API error handling on invalid credentials."""
    mock_401 = MagicMock()
    mock_401.status_code = 401
    mock_401.text = "Unauthorized"

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_401

    with patch("app.core.config.settings.PAYYANTRA_CLIENT_ID", "bad_client_id"):
        with patch("app.core.config.settings.PAYYANTRA_CLIENT_SECRET", "bad_secret"):
            with patch("app.services.payyantra_service.httpx.Client", return_value=mock_client):
                with pytest.raises(Exception) as excinfo:
                    PayYantraService.get_auth_token(force_refresh=True)
                assert "401" in str(excinfo.value) or "Invalid PayYantra credentials" in str(excinfo.value)


def test_payyantra_create_order_checkout_url_extraction(auth_headers):
    """Verify order creation and extraction of genuine checkoutUrl."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "payyantra_tester@example.com").first()
        assert user is not None

        import uuid
        test_order = Order(
            order_number=f"TEST-ORD-{uuid.uuid4().hex[:8]}",
            user_id=user.id,
            status=OrderStatus.PLACED,
            subtotal=999.0,
            discount_amount=0.0,
            shipping_fee=0.0,
            tax_amount=120.0,
            total_amount=1119.0,
            currency="INR",
            shipping_address={"full_name": "Tester", "city": "Mumbai", "postal_code": "400001"},
        )
        db.add(test_order)
        db.commit()
        db.refresh(test_order)

        py_mock_order_id = f"PYOR_TEST_{uuid.uuid4().hex[:8]}"
        mock_order_api_resp = MagicMock()
        mock_order_api_resp.status_code = 201
        mock_order_api_resp.json.return_value = {
            "statusCode": 201,
            "data": {
                "orderId": py_mock_order_id,
                "transactionId": f"PYTR_TXN_{uuid.uuid4().hex[:8]}",
                "transactionPublicId": "3f2a9c1e-0000-0000-0000-000000000000",
                "referenceId": f"INV-{test_order.order_number}",
                "checkoutUrl": "https://payin-api-uat.payyantra.com/api/public/pay/checkout/v3/3f2a9c1e-0000-0000-0000-000000000000?access_token=token123",
                "status": "INITIATED",
                "amount": 1119.0,
                "currency": "INR",
                "merchantOrderId": f"ORD-{test_order.order_number}",
                "checkoutVersion": "v3",
            },
        }

        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.post.return_value = mock_order_api_resp

        with patch.object(PayYantraService, "get_auth_token", return_value="valid_mock_token"):
            with patch("app.services.payyantra_service.httpx.Client", return_value=mock_client):
                checkout_resp = client.post(
                    "/api/payments/payyantra/checkout",
                    json={"order_id": test_order.id},
                    headers=auth_headers,
                )
                assert checkout_resp.status_code == 200, checkout_resp.text
                cdata = checkout_resp.json()
                assert "checkout_url" in cdata
                assert "3f2a9c1e" in cdata["checkout_url"]
                assert cdata["payyantra_order_id"] == py_mock_order_id

                # Verify payment record persisted in PostgreSQL
                db.refresh(test_order)
                assert len(test_order.payments) > 0
                py_payment = test_order.payments[0]
                assert py_payment.provider == PaymentProvider.PAYYANTRA
                assert py_payment.payyantra_order_id == py_mock_order_id
                assert py_payment.status == PaymentStatus.PENDING
    finally:
        db.close()


def test_payyantra_status_polling_and_confirmation(auth_headers):
    """Verify order status lookup updates database and confirms order on SUCCESS."""
    import uuid
    uid = uuid.uuid4().hex[:8]
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "payyantra_tester@example.com").first()
        test_order = Order(
            order_number=f"TEST-STATUS-{uid}",
            user_id=user.id,
            status=OrderStatus.PLACED,
            subtotal=500.0,
            discount_amount=0.0,
            shipping_fee=0.0,
            tax_amount=60.0,
            total_amount=560.0,
            currency="INR",
            shipping_address={"full_name": "Tester", "city": "Bengaluru", "postal_code": "560001"},
        )
        db.add(test_order)
        db.commit()
        db.refresh(test_order)

        payment = Payment(
            order_id=test_order.id,
            provider=PaymentProvider.PAYYANTRA,
            payyantra_order_id=f"PYOR_VERIFY_{uid}",
            merchant_order_id=f"ORD-{test_order.order_number}",
            reference_id=f"INV-{test_order.order_number}",
            amount=560.0,
            currency="INR",
            status=PaymentStatus.PENDING,
        )
        db.add(payment)
        db.commit()

        # Mock PayYantra status API returning SUCCESS with RRN
        mock_status_data = {
            "status": "SUCCESS",
            "orderId": f"PYOR_VERIFY_{uid}",
            "referenceId": f"INV-{test_order.order_number}",
            "amount": "560.00",
            "currency": "INR",
            "rrn": "66136709799",
        }

        with patch.object(PayYantraService, "is_configured", return_value=True):
            with patch.object(PayYantraService, "get_status_by_order_id", return_value=mock_status_data):
                status_resp = client.get(
                    f"/api/payments/payyantra/status/{test_order.id}",
                    headers=auth_headers,
                )
                assert status_resp.status_code == 200, status_resp.text
                sdata = status_resp.json()
                assert sdata["payment_status"] == "captured"
                assert sdata["order_status"] == "confirmed"
                assert sdata["rrn"] == "66136709799"

                # Verify database update in PostgreSQL
                db.refresh(test_order)
                db.refresh(payment)
                assert test_order.status == OrderStatus.CONFIRMED
                assert payment.status == PaymentStatus.CAPTURED
                assert payment.rrn == "66136709799"
    finally:
        db.close()


def test_payyantra_webhook_processing_and_idempotency():
    """Verify webhook notification processing and duplicate delivery handling."""
    import uuid
    uid = uuid.uuid4().hex[:8]
    db = SessionLocal()
    try:
        user = db.query(User).first()
        ord_num = f"TEST-WH-{uid}"
        test_order = Order(
            order_number=ord_num,
            user_id=user.id,
            status=OrderStatus.PLACED,
            subtotal=799.0,
            discount_amount=0.0,
            shipping_fee=0.0,
            tax_amount=95.0,
            total_amount=894.0,
            currency="INR",
            shipping_address={"full_name": "Webhook Tester", "city": "Delhi", "postal_code": "110001"},
        )
        db.add(test_order)
        db.commit()
        db.refresh(test_order)

        payment = Payment(
            order_id=test_order.id,
            provider=PaymentProvider.PAYYANTRA,
            merchant_order_id=f"ORD-{ord_num}",
            reference_id=f"INV-{ord_num}",
            transaction_id=f"TXN-PYTR-WH-{uid}",
            amount=894.0,
            currency="INR",
            status=PaymentStatus.PENDING,
        )
        db.add(payment)
        db.commit()

        webhook_payload = {
            "orderId": f"ORD-{ord_num}",
            "referenceId": f"INV-{ord_num}",
            "amount": 894.0,
            "currency": "INR",
            "status": "SUCCESS",
            "terminalStatus": "SUCCESS",
            "txnId": f"TXN-PYTR-WH-{uid}",
            "rrn": "778899001122",
            "errorCode": None,
            "errorMessage": None,
            "psp_payment_information": {
                "utr": "778899001122",
                "rrn": "778899001122",
            },
            "timestamp": "2026-10-19T10:30:00.000Z",
        }

        # First delivery
        wh_resp1 = client.post("/api/payments/payyantra/webhook", json=webhook_payload)
        assert wh_resp1.status_code == 200
        assert wh_resp1.json()["status"] == "success"

        db.refresh(test_order)
        db.refresh(payment)
        assert test_order.status == OrderStatus.CONFIRMED
        assert payment.status == PaymentStatus.CAPTURED
        assert payment.rrn == "778899001122"

        # Second delivery (Duplicate webhook retry)
        wh_resp2 = client.post("/api/payments/payyantra/webhook", json=webhook_payload)
        assert wh_resp2.status_code == 200
        assert wh_resp2.json()["status"] == "already_processed"
    finally:
        db.close()
