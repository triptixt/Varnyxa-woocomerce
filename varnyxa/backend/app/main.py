from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.db.session import get_db

from app.api.routes import (
    auth,
    addresses,
    products,
    cart,
    wishlist,
    coupons,
    orders,
    payments,
    reviews,
    admin,
    settings as settings_routes,
    subscriptions as subscriptions_routes,
    newsletter as newsletter_routes,
)

app = FastAPI(
    title="VARNYXA Fashion API",
    description="Full-stack enterprise clothing e-commerce platform backend for VARNYXA.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS setup
origins = settings.cors_origins
if not origins:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.services.polling_service import PollingService
from app.services.settings_service import SettingsService
from app.services.subscription_service import SubscriptionService
from app.db.session import SessionLocal


@app.on_event("startup")
async def startup_event():
    # Seed default store settings and subscription plans if not existing
    db = SessionLocal()
    try:
        SettingsService.initialize_settings(db)
        SubscriptionService.initialize_plans(db)
    except Exception as e:
        print(f"Startup seeding notice: {e}")
    finally:
        db.close()

    # Launch automated background payment and order status polling worker
    await PollingService.start_background_loop()


@app.on_event("shutdown")
def shutdown_event():
    PollingService.stop_background_loop()


# Health & Status Endpoint
@app.get("/api/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "app": "VARNYXA",
        "version": settings.VERSION,
        "database": db_status,
        "currency": settings.STORE_CURRENCY,
    }


# Include All Route Modules
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(addresses.router, prefix=settings.API_V1_STR)
app.include_router(products.router, prefix=settings.API_V1_STR)
app.include_router(cart.router, prefix=settings.API_V1_STR)
app.include_router(wishlist.router, prefix=settings.API_V1_STR)
app.include_router(coupons.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(reviews.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(settings_routes.router, prefix=settings.API_V1_STR)
app.include_router(subscriptions_routes.router, prefix=settings.API_V1_STR)
app.include_router(newsletter_routes.router, prefix=settings.API_V1_STR)

