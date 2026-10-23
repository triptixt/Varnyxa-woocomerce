# VARNYXA Frontend

Contemporary, inclusive luxury fashion storefront built with React 19, TypeScript, Vite, and Tailwind CSS v4.

## Technology Stack

- **Core**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with custom luxury fashion design system
- **Routing**: React Router v7
- **Icons**: Lucide React
- **State Management**: React Context API (`AuthContext`, `CartContext`, `WishlistContext`, `ToastContext`)
- **API Client**: Centralized typed HTTP client with JWT interceptor

## Key Features

- **Inclusive Fashion Catalog**: Collections for Men, Women, Unisex, Boys, Girls, Baby, Teens, Adults, and Seniors
- **Advanced Multi-Faceted Filters**: Real-time filtering by Gender, Category, Price Range, Sizes, Colors, and Stock
- **Interactive Product Details**: Multi-angle image galleries, size guide modals, live inventory badges, and postal code delivery estimator
- **Shopping Bag & Wishlist**: Slide-over cart drawer with free shipping progress bar, quantity steppers, and coupon redemption
- **Seamless Checkout**: Address management, server-side pricing validation, GST calculation, Razorpay modal integration, and Cash on Delivery
- **Protected Admin Console**: Real database analytics, product creation modal, order fulfillment updater, and coupon manager

## Running Locally

```powershell
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.
