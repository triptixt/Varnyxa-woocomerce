import {
  User,
  Address,
  Category,
  Brand,
  ProductListItem,
  ProductDetail,
  PaginatedProducts,
  Cart,
  Wishlist,
  Order,
  Review,
  Coupon,
  AdminMetrics,
  PaymentConfig,
  PayYantraCheckoutResponse,
  PayYantraStatusResponse,
  PriceBounds,
  StoreSettings,
  SubscriptionPlan,
  UserSubscription,
  DiscountSliderResult,
  SubscriptionStatusResponse,
  PollingStatus,
  AdminSubscription,
  NewsletterSubscriber,
  NewsletterSubscribeResponse,
  NewsletterStatusResponse,
  NewsletterAdminListResponse,
  RazorpayOrderResponse,
  RazorpayStatusResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Helper to get or create guest session token
export function getGuestSessionToken(): string {
  let token = localStorage.getItem('varnyxa_guest_token');
  if (!token) {
    token = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('varnyxa_guest_token', token);
  }
  return token;
}

// Token management helper
export function getAuthToken(): string | null {
  return localStorage.getItem('varnyxa_auth_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('varnyxa_auth_token', token);
  } else {
    localStorage.removeItem('varnyxa_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Include guest session token for cart endpoints
  const guestToken = getGuestSessionToken();
  headers.set('X-Session-Token', guestToken);

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'omit', // Standard bearer token handling
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorJson = await response.json();
      if (Array.isArray(errorJson.detail)) {
        errorMessage = errorJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof errorJson.detail === 'string') {
        errorMessage = errorJson.detail;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      } else if (errorJson.detail) {
        errorMessage = JSON.stringify(errorJson.detail);
      }
    } catch {
      // Fallback to response text
      const errorText = await response.text();
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Authentication
  auth: {
    login: (data: { email: string; password: string }) =>
      request<{ access_token: string; token_type: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    register: (data: { email: string; password: string; full_name: string; phone?: string; agree_terms: boolean }) =>
      request<{ access_token: string; token_type: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
    getMe: () => request<User>('/auth/me'),
    updateProfile: (data: { full_name?: string; phone?: string }) =>
      request<User>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    changePassword: (data: { current_password: string; new_password: string }) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    provisionAdmin: (data: { admin_provision_key: string; email: string; password: string; full_name: string }) =>
      request<User>('/auth/provision-admin', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Catalog
  products: {
    getCatalog: (params?: Record<string, any>) => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            searchParams.append(k, String(v));
          }
        });
      }
      const queryStr = searchParams.toString();
      return request<PaginatedProducts>(`/products${queryStr ? `?${queryStr}` : ''}`);
    },
    getBySlug: (slug: string) => request<ProductDetail>(`/products/slug/${slug}`),
    getById: (id: string) => request<ProductDetail>(`/products/id/${id}`),
    getFeatured: (limit = 8) => request<ProductListItem[]>(`/products/featured?limit=${limit}`),
    getNewArrivals: (limit = 8) => request<ProductListItem[]>(`/products/new-arrivals?limit=${limit}`),
    getBestSellers: (limit = 8) => request<ProductListItem[]>(`/products/best-sellers?limit=${limit}`),
    getRelated: (id: string, limit = 4) => request<ProductListItem[]>(`/products/${id}/related?limit=${limit}`),
    getCategories: () => request<Category[]>('/products/categories'),
    getBrands: () => request<Brand[]>('/products/brands'),
    getPriceBounds: () => request<PriceBounds>('/products/price-bounds'),
  },

  // Cart
  cart: {
    getCart: (couponCode?: string) =>
      request<Cart>(`/cart${couponCode ? `?coupon_code=${encodeURIComponent(couponCode)}` : ''}`),
    addItem: (variantId: string, quantity = 1) =>
      request<Cart>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ variant_id: variantId, quantity }),
      }),
    updateItem: (itemId: string, quantity: number) =>
      request<Cart>(`/cart/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
      }),
    removeItem: (itemId: string) =>
      request<Cart>(`/cart/items/${itemId}`, {
        method: 'DELETE',
      }),
    clearCart: () => request<Cart>('/cart', { method: 'DELETE' }),
    mergeCart: (sessionToken: string) =>
      request<Cart>('/cart/merge', {
        method: 'POST',
        body: JSON.stringify({ session_token: sessionToken }),
      }),
  },

  // Wishlist
  wishlist: {
    getWishlist: () => request<Wishlist>('/wishlist'),
    toggle: (productId: string) =>
      request<{ in_wishlist: boolean; message: string }>(`/wishlist/toggle/${productId}`, {
        method: 'POST',
      }),
  },

  // Coupons
  coupons: {
    validate: (code: string, subtotal: number) =>
      request<{ valid: boolean; code: string; discount_amount: number; discount_type: string; message: string }>(
        '/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code, subtotal }),
        }
      ),
  },

  // Addresses
  addresses: {
    list: () => request<Address[]>('/addresses'),
    create: (data: Partial<Address>) =>
      request<Address>('/addresses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Address>) =>
      request<Address>(`/addresses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request<{ message: string }>(`/addresses/${id}`, { method: 'DELETE' }),
  },

  // Orders
  orders: {
    create: (data: { address_id?: string; shipping_address?: any; coupon_code?: string; payment_provider: string }) =>
      request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: () => request<Order[]>('/orders'),
    getById: (orderId: string) => request<Order>(`/orders/${orderId}`),
    getReceipt: (orderId: string) => request<any>(`/orders/${orderId}/receipt`),
    cancel: (orderId: string, reason: string) =>
      request<Order>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  // Payments
  payments: {
    getConfig: () => request<PaymentConfig>('/payments/config'),
    getRazorpayDiagnostics: () => request<any>('/payments/razorpay/diagnostics'),
    getPayYantraDiagnostics: () => request<any>('/payments/payyantra/diagnostics'),
    
    // PayYantra Hosted Checkout V3
    createPayYantraCheckout: (orderId: string, paymentMethod?: string, returnUrl?: string) =>
      request<PayYantraCheckoutResponse>('/payments/payyantra/checkout', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod, return_url: returnUrl }),
      }),
    getPayYantraStatus: (orderId: string) =>
      request<PayYantraStatusResponse>(`/payments/payyantra/status/${orderId}`),

    // Razorpay Integration
    createRazorpayOrder: (orderId: string, paymentMethod?: string) =>
      request<RazorpayOrderResponse>('/payments/razorpay/create-order', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod }),
      }),
    getRazorpayStatus: (orderId: string) =>
      request<RazorpayStatusResponse>(`/payments/razorpay/status/${orderId}`),
    verifyRazorpay: (data: { order_id: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
      request<{ verified: boolean; message: string }>('/payments/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Demo Payment Flow (Distinct from real gateways)
    completeDemoPayment: (data: { order_id: string; payment_method?: string; reference_id?: string }) =>
      request<Order>('/payments/demo/complete', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Unified Payment & Order Status Sync
    getUnifiedStatus: (orderId: string) =>
      request<{
        order_id: string;
        order_number: string;
        payment_status: string;
        order_status: string;
        provider?: string;
        reference_id?: string;
        verified_at?: string;
      }>(`/payments/status/${orderId}`),
  },

  // Reviews
  reviews: {
    getByProduct: (productId: string) => request<Review[]>(`/reviews/product/${productId}`),
    submit: (data: { product_id: string; rating: number; title?: string; comment: string }) =>
      request<Review>('/reviews', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Administrator Dashboard
  admin: {
    getMetrics: () => request<AdminMetrics>('/admin/metrics'),
    createProduct: (data: any) =>
      request<ProductDetail>('/admin/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateProduct: (productId: string, data: any) =>
      request<ProductDetail>(`/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteProduct: (productId: string) =>
      request<{ message: string }>(`/admin/products/${productId}`, { method: 'DELETE' }),
    addVariant: (productId: string, data: any) =>
      request<any>(`/admin/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    addImage: (productId: string, data: any) =>
      request<any>(`/admin/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createCategory: (data: any) =>
      request<Category>('/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getOrders: (status?: string) =>
      request<Order[]>(`/admin/orders${status ? `?status=${status}` : ''}`),
    updateOrderStatus: (orderId: string, data: { status: string; tracking_number?: string; courier_partner?: string }) =>
      request<Order>(`/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getCoupons: () => request<Coupon[]>('/admin/coupons'),
    createCoupon: (data: any) =>
      request<Coupon>('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    importSeedCatalog: () =>
      request<{ success: boolean; message: string }>('/admin/import-seed-catalog', { method: 'POST' }),
    getPollingStatus: () =>
      request<PollingStatus>('/admin/payments/polling-status'),
    pollNow: () =>
      request<any>('/admin/payments/poll-now', { method: 'POST' }),
    refreshOrderPayment: (orderId: string) =>
      request<PayYantraStatusResponse>(`/admin/orders/${orderId}/refresh-payment-status`, { method: 'POST' }),
    getNewsletterSubscribers: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', params.page.toString());
      if (params?.limit) q.set('limit', params.limit.toString());
      if (params?.status) q.set('status', params.status);
      if (params?.search) q.set('search', params.search);
      const qs = q.toString();
      return request<NewsletterAdminListResponse>(`/admin/newsletter/subscribers${qs ? `?${qs}` : ''}`);
    },
    updateNewsletterSubscriberStatus: (subscriberId: string, status: 'active' | 'unsubscribed') =>
      request<NewsletterSubscriber>(`/admin/newsletter/subscribers/${subscriberId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    exportNewsletterSubscribersUrl: (status?: string) =>
      `${API_BASE_URL}/admin/newsletter/export${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  },

  // Store Settings & Business Rules
  settings: {
    getPublic: () => request<StoreSettings>('/settings/public'),
    getAdmin: () => request<Record<string, any>>('/admin/settings'),
    updateAdmin: (data: Partial<StoreSettings>) =>
      request<Record<string, any>>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    setDiscountSlider: (discountPercent: number, reason?: string) =>
      request<DiscountSliderResult>('/admin/discount-slider', {
        method: 'POST',
        body: JSON.stringify({ discount_percent: discountPercent, reason }),
      }),
  },

  // Subscriptions & Premium Membership
  subscriptions: {
    getPlans: () => request<SubscriptionPlan[]>('/subscriptions/plans'),
    getMySubscription: async () => {
      const res = await request<any>('/subscriptions/me');
      if (res && res.subscription) {
        return {
          ...res.subscription,
          is_active: Boolean(res.has_active_subscription ?? res.subscription.is_active),
        } as UserSubscription;
      }
      return null;
    },
    getStatus: (subscriptionId: string) =>
      request<SubscriptionStatusResponse>(`/subscriptions/status/${subscriptionId}`),
    subscribe: (data: { plan_id: string; payment_method?: string }) =>
      request<{
        success: boolean;
        message: string;
        checkout_url?: string;
        subscription_id?: string;
        payment_reference?: string;
        payyantra_order_id?: string;
        subscription?: UserSubscription;
      }>('/subscriptions/subscribe', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePlan: (planId: string, data: Partial<SubscriptionPlan>) =>
      request<SubscriptionPlan>(`/subscriptions/admin/plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getAllAdmin: () => request<AdminSubscription[]>('/subscriptions/admin/all'),
    refreshAdmin: (subscriptionId: string) =>
      request<SubscriptionStatusResponse>(`/subscriptions/admin/refresh/${subscriptionId}`, { method: 'POST' }),
  },

  // Newsletter Subscription
  newsletter: {
    subscribe: (data: { email: string; consent?: boolean; source?: string }) =>
      request<NewsletterSubscribeResponse>('/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getStatus: (email: string) =>
      request<NewsletterStatusResponse>(`/newsletter/status?email=${encodeURIComponent(email)}`),
    unsubscribe: (token: string, reason?: string) =>
      request<{ success: boolean; message: string; email: string }>('/newsletter/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ token, reason }),
      }),
    getUnsubscribeInfo: (token: string) =>
      request<{ email: string; status: string; consent_at: string; masked_email: string }>(
        `/newsletter/unsubscribe-info?token=${encodeURIComponent(token)}`
      ),
  },
};
