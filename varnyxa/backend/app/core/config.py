from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "VARNYXA Fashion API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"  # Base API route prefix

    DATABASE_URL: str
    SECRET_KEY: str = "default_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000"

    # Razorpay Credentials (legacy)
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # PayYantra Payment Gateway (Hosted Checkout V3)
    PAYYANTRA_BASE_URL: str = "https://payin-api-uat.payyantra.com"
    PAYYANTRA_CLIENT_ID: str = ""
    PAYYANTRA_CLIENT_SECRET: str = ""
    PAYYANTRA_RETURN_URL: str = "http://localhost:5174/payment/payyantra/callback"
    PAYYANTRA_NOTIFY_URL: str = "http://localhost:8000/api/payments/payyantra/webhook"
    PAYYANTRA_API_VERSION: str = "2024-01-01"
    PAYYANTRA_TEST_MODE: bool = False  # When True in UAT, caps test amounts <= 10.00 as recommended by docs
    PAYYANTRA_POLL_INTERVAL_SECONDS: int = 60
    PAYYANTRA_POLL_MAX_RETRIES: int = 30
    PAYYANTRA_MAX_PENDING_MINUTES: int = 45

    # Store Defaults (Indian Fashion E-Commerce)
    STORE_CURRENCY: str = "INR"
    STORE_CURRENCY_SYMBOL: str = "₹"
    FREE_SHIPPING_THRESHOLD: float = 1499.0
    STANDARD_SHIPPING_FEE: float = 99.0
    DEFAULT_GST_PERCENT: float = 12.0

    # Administrative provision key
    ADMIN_PROVISION_KEY: str = "default_admin_key"

    # Newsletter & Email Provider Configuration (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "club@varnyxa.com"
    EMAILS_FROM_NAME: str = "VARNYXA Club"

    @field_validator(
        "PAYYANTRA_CLIENT_ID",
        "PAYYANTRA_CLIENT_SECRET",
        "PAYYANTRA_BASE_URL",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
        mode="before",
    )
    @classmethod
    def strip_whitespace(cls, v: Optional[str]) -> str:
        if isinstance(v, str):
            return v.strip()
        return "" if v is None else str(v)

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE_PATH), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
