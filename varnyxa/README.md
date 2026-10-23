# VARNYXA — Inclusive Contemporary Fashion Marketplace

**VARNYXA** is a full-stack luxury and everyday fashion e-commerce platform built from scratch. It celebrates inclusive design across every generation and gender: Men, Women, Unisex, Boys, Girls, Baby, Teens, Adults, and Seniors.

---

## Architecture Overview

```text
varnyxa/
├── frontend/                     # React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── components/           # Reusable UI (Navbar, Footer, ProductCard, Filters, CartDrawer)
│   │   ├── context/              # AuthContext, CartContext, WishlistContext, ToastContext
│   │   ├── layouts/              # MainLayout, AdminLayout
│   │   ├── pages/                # HomePage, ShopPage, ProductDetailPage, CartPage, CheckoutPage, etc.
│   │   ├── services/             # Centralized typed API client
│   │   ├── types/                # TypeScript interfaces matching backend models
│   │   └── utils/                # Currency formatters (INR ₹), date utilities
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── backend/                      # FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL
│   ├── app/
│   │   ├── api/routes/           # auth, products, cart, wishlist, coupons, orders, payments, admin
│   │   ├── core/                 # Pydantic Settings, Argon2 / JWT security
│   │   ├── db/                   # SessionLocal engine, DeclarativeBase
│   │   ├── models/               # User, Category, Brand, Product, Variant, Cart, Order, Payment
│   │   ├── schemas/              # Typed Pydantic request / response schemas
│   │   ├── services/             # AuthService, CatalogService, CartService, OrderService, PaymentService
│   │   └── utils/                # seed_catalog.py, provision_admin.py
│   ├── alembic/                  # Version-controlled migrations
│   ├── tests/                    # Pytest test suite
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── .env.example
│   └── README.md
├── .gitignore
└── README.md
```

---

## Windows Setup Instructions (PowerShell)

### 1. Database Setup
PostgreSQL 18 is running locally. The dedicated database `varnyxa_db` has been created and migrated.

### 2. Backend Setup & Run
Open a PowerShell terminal in the `varnyxa/backend` directory:
```powershell
# Navigate to backend
cd "c:\Users\anura\VARNYXA APP\varnyxa\backend"

# Install backend dependencies
python -m pip install -r requirements.txt

# Run Alembic migrations
python -m alembic upgrade head

# Seed initial authentic catalog & provision initial administrator
python -m app.utils.seed_catalog
python -m app.utils.provision_admin --email admin@varnyxa.com --password Admin@Varnyxa2026 --name "VARNYXA SuperAdmin"

# Run automated tests
python -m pytest

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Health Status: `http://127.0.0.1:8000/api/health`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup & Run
Open a second PowerShell terminal in the `varnyxa/frontend` directory:
```powershell
# Navigate to frontend
cd "c:\Users\anura\VARNYXA APP\varnyxa\frontend"

# Install node dependencies
npm install

# Build check
npm run build

# Start Vite development server (runs on port 5173 or 5174)
npm run dev
```
- Storefront Web Application: `http://localhost:5174` (or `http://localhost:5173`)

---

## Admin Credentials

- **Email**: `admin@varnyxa.com`
- **Password**: `Admin@Varnyxa2026`
- **Console URL**: `http://localhost:5174/admin` (or `http://localhost:5173/admin`)
*(Also accessible from the user dropdown in the header when signed in as administrator)*

---

## Verification & Real-Data Assurance

- **Zero Mock Fallbacks**: Products, reviews, variants, prices, inventory, cart lines, addresses, and orders originate from real PostgreSQL database transactions.
- **Atomic Concurrency**: Inventory is reserved atomically with database locking during order placement to prevent overselling.
- **Razorpay Integration**: Official SDK integrated with server-side HMAC-SHA256 signature verification and Cash on Delivery fallback.
- **Strict Separation**: Frontend and backend are completely decoupled and communicate over typed REST endpoints.
