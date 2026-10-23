export type Gender = 'men' | 'women' | 'unisex' | 'boys' | 'girls' | 'baby';

export type AgeGroup = 'newborn' | 'infant' | 'toddler' | 'kids' | 'teens' | 'adults' | 'seniors';

export type UserRole = 'customer' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  address_type: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  display_order: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color_name: string;
  color_hex: string;
  sku: string;
  price_override?: number | null;
  stock_quantity: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string;
  is_primary: boolean;
  display_order: number;
  variant_id?: string | null;
}

export interface ProductListItem {
  id: string;
  title: string;
  slug: string;
  base_price: number;
  sale_price?: number | null;
  discount_percent: number;
  gender: Gender;
  age_group: AgeGroup;
  category_name: string;
  brand_name?: string | null;
  primary_image_url?: string | null;
  rating_average: number;
  review_count: number;
  total_stock: number;
  available_sizes: string[];
  available_colors: { name: string; hex: string }[];
  is_featured: boolean;
}

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  material_care?: string | null;
  sku_prefix: string;
  base_price: number;
  sale_price?: number | null;
  discount_percent: number;
  gender: Gender;
  age_group: AgeGroup;
  category: Category;
  brand?: Brand | null;
  fabric?: string | null;
  fit?: string | null;
  sleeve_length?: string | null;
  occasion?: string | null;
  season?: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
  images: ProductImage[];
  rating_average: number;
  review_count: number;
  total_stock: number;
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  min_price: number;
  max_price: number;
  available_categories: { id: string; name: string; slug: string; count: number }[];
  available_brands: { id: string; name: string; slug: string; count: number }[];
  available_fabrics: string[];
  available_fits: string[];
  available_occasions: string[];
}

export interface PriceBounds {
  min_price: number;
  max_price: number;
  catalog_min_price: number;
  catalog_max_price: number;
  preset_counts: {
    under_500: number;
    '500_1000': number;
    '1000_2500': number;
    '2500_5000': number;
    '5000_above': number;
  };
}

export interface CartItem {
  id: string;
  variant_id: string;
  product_id: string;
  product_title: string;
  product_slug: string;
  size: string;
  color_name: string;
  color_hex: string;
  sku: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  stock_quantity: number;
  image_url?: string | null;
}

export interface Cart {
  id: string;
  user_id?: string | null;
  session_token?: string | null;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  discount_amount: number;
  coupon_code?: string | null;
  shipping_fee: number;
  tax_amount: number;
  total_amount: number;
  tax_rate?: number;
  shipping_threshold?: number;
  is_free_shipping?: boolean;
  admin_discount_percent?: number;
}

export interface WishlistItem {
  id: string;
  product_id: string;
  product_title: string;
  product_slug: string;
  base_price: number;
  sale_price?: number | null;
  discount_percent: number;
  primary_image_url?: string | null;
  is_in_stock: boolean;
  added_at: string;
}

export interface Wishlist {
  id: string;
  user_id: string;
  items: WishlistItem[];
  item_count: number;
}

export type OrderStatus = 'pending' | 'placed' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';
export type PaymentProvider = 'payyantra' | 'razorpay' | 'cod' | 'demo';
export type PaymentStatus = 'pending' | 'captured' | 'failed' | 'refunded' | 'demo_completed';

export interface OrderItem {
  id: string;
  product_id?: string | null;
  variant_id?: string | null;
  product_title: string;
  sku: string;
  size: string;
  color_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  image_url?: string | null;
}

export interface OrderPayment {
  id: string;
  provider: PaymentProvider;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  payyantra_order_id?: string | null;
  merchant_order_id?: string | null;
  reference_id?: string | null;
  transaction_id?: string | null;
  transaction_public_id?: string | null;
  checkout_url?: string | null;
  rrn?: string | null;
  payment_method?: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  created_at: string;
  verified_at?: string | null;
}

export interface PayYantraCheckoutResponse {
  checkout_url: string;
  order_id: string;
  order_number: string;
  payyantra_order_id: string;
  transaction_id: string;
  transaction_public_id?: string | null;
  amount: number;
  currency: string;
  payment_method?: string | null;
  qr_data?: string | null;
  qr_url?: string | null;
  upi_intent_url?: string | null;
  expires_at?: string | null;
}

export interface PayYantraStatusResponse {
  order_id: string;
  order_number: string;
  payment_status: PaymentStatus;
  order_status: string;
  payyantra_order_id?: string | null;
  reference_id?: string | null;
  transaction_id?: string | null;
  amount: number;
  currency: string;
  rrn?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  verified_at?: string | null;
}

export interface PaymentConfig {
  payyantra_configured: boolean;
  razorpay_configured: boolean;
  active_provider: 'payyantra' | 'razorpay' | 'cod';
  admin_cod_available?: boolean;
  currency: string;
  currency_symbol: string;
}

export interface RazorpayOrderResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  payment_method?: string | null;
  qr_id?: string | null;
  qr_image_url?: string | null;
  qr_data?: string | null;
}

export interface RazorpayStatusResponse {
  order_id: string;
  order_number: string;
  payment_status: PaymentStatus;
  order_status: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  amount?: number | null;
  currency: string;
  verified_at?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  payment_reference_id?: string | null;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  coupon_code?: string | null;
  shipping_fee: number;
  tax_amount: number;
  tax_rate?: number;
  shipping_threshold?: number;
  total_amount: number;
  currency: string;
  shipping_address: Record<string, any>;
  tracking_number?: string | null;
  courier_partner?: string | null;
  delivered_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payments: OrderPayment[];
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  title?: string | null;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount?: number | null;
  valid_from: string;
  valid_to?: string | null;
  usage_limit?: number | null;
  times_used: number;
  is_active: boolean;
}

export interface AdminMetrics {
  total_sales: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  pending_orders: number;
  shipped_orders: number;
  delivered_orders: number;
  low_stock_count: number;
  sales_by_gender: Record<string, number>;
  recent_orders: Order[];
}

export interface StoreSettings {
  gst_rate: number;
  gst_mode: string;
  standard_shipping_fee: number;
  free_shipping_threshold: number;
  admin_global_discount: number;
  default_theme: string;
  admin_allow_cod?: boolean;
  active_payment_gateway?: 'razorpay' | 'payyantra';
  currency: string;
  currency_symbol: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  price: number;
  duration_days: number;
  description: string;
  benefits: string[];
  is_active: boolean;
  display_order: number;
}

export interface UserSubscription {
  id: string;
  plan_name: string;
  plan_code: string;
  status: string;
  payment_status?: string;
  amount_paid?: number;
  price_paid?: number;
  start_date: string;
  expiry_date: string;
  payment_reference: string;
  benefits: string[];
  is_active: boolean;
  days_remaining: number;
}

export interface DiscountSliderResult {
  status: string;
  discount_percent: number;
  applied_by: string;
  timestamp: string;
  message: string;
}

export interface SubscriptionStatusResponse {
  subscription_id: string;
  plan_name: string;
  payment_status: string;
  subscription_status: string;
  is_active: boolean;
  amount: number;
  payment_reference?: string | null;
  payyantra_order_id?: string | null;
  start_date?: string | null;
  expiry_date?: string | null;
  days_remaining: number;
  error_description?: string | null;
  verified_at?: string | null;
}

export interface PollingStatus {
  last_polled_at: string | null;
  status: string;
  orders_checked: number;
  subscriptions_checked: number;
  orders_updated: number;
  subscriptions_updated: number;
  last_error: string | null;
  interval_seconds: number;
  max_retries: number;
  max_pending_minutes: number;
  is_gateway_configured: boolean;
}

export interface AdminSubscription {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  status: string;
  payment_status: string;
  amount_paid: number;
  payment_reference?: string | null;
  payyantra_order_id?: string | null;
  start_date: string;
  expiry_date: string;
  days_remaining: number;
  poll_count: number;
  poll_error?: string | null;
  last_polled_at?: string | null;
  created_at: string;
}

// Newsletter
export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: 'active' | 'unsubscribed';
  consent_at: string;
  unsubscribed_at?: string | null;
  source: string;
  created_at: string;
}

export interface NewsletterSubscribeResponse {
  success: boolean;
  message: string;
  email: string;
  status: string;
  is_new_subscriber: boolean;
  email_dispatched: boolean;
  email_note?: string;
  unsubscribe_url?: string;
}

export interface NewsletterStatusResponse {
  email: string;
  is_subscribed: boolean;
  status: string;
  consent_at?: string | null;
}

export interface NewsletterAdminListResponse {
  items: NewsletterSubscriber[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  active_count: number;
  unsubscribed_count: number;
}

