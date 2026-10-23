# VARNYXA Backend API

FastAPI-powered enterprise clothing e-commerce backend with PostgreSQL, SQLAlchemy 2.0, Alembic, and Razorpay integration.

## Architecture

- **Framework**: FastAPI (Asynchronous Python REST API)
- **Database**: PostgreSQL (`varnyxa_db`) on port 5433
- **ORM**: SQLAlchemy 2.0 with type annotations & psycopg 3 driver
- **Migrations**: Alembic (`alembic/versions`)
- **Authentication**: Argon2 / bcrypt password hashing with JWT Bearer tokens & HTTP-only cookies
- **Payment Processing**: Razorpay official SDK with HMAC SHA256 signature verification and webhooks
- **Testing**: Pytest with isolated fixtures

## Getting Started

### 1. Prerequisites
- Python 3.12+
- PostgreSQL (running locally)

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your settings:
```powershell
Copy-Item .env.example .env
```

Ensure `DATABASE_URL` matches your local PostgreSQL installation:
```text
DATABASE_URL=postgresql+psycopg://postgres:your_password@127.0.0.1:5433/varnyxa_db
```

### 3. Run Migrations
```powershell
python -m alembic upgrade head
```

### 4. Seed Clothing Catalog & Provision Admin
```powershell
# Populate categories, brands, coupons, and authentic reference garments
python -m app.utils.seed_catalog

# Provision the super administrator account
python -m app.utils.provision_admin --email admin@varnyxa.com --password Admin@Varnyxa2026 --name "VARNYXA SuperAdmin"
```

### 5. Start FastAPI Development Server
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger UI will be accessible at: `http://127.0.0.1:8000/docs`

### 6. Run Automated Pytest Suite
```powershell
python -m pytest
```
