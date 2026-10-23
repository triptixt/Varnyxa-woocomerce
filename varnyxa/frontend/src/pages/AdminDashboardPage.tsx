import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  ShieldCheck,
  Shield,
  CheckCircle,
  Truck,
  DollarSign,
  Tag,
  RefreshCw,
  Search,
  X,
  Sparkles,
  Sliders,
  Percent,
  Settings as SettingsIcon,
  Crown,
  Save,
  Check,
  Activity,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Mail,
  Download,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, getAuthToken } from '../services/api';
import {
  AdminMetrics,
  Order,
  Category,
  Brand,
  Coupon,
  ProductDetail,
  StoreSettings,
  SubscriptionPlan,
  PollingStatus,
  AdminSubscription,
  NewsletterSubscriber,
} from '../types';
import { formatPrice, formatDate } from '../utils/formatters';

export const AdminDashboardPage: React.FC = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'metrics' | 'orders' | 'subscriptions' | 'coupons' | 'discounts' | 'settings' | 'newsletter'>('metrics');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus | null>(null);
  const [adminSubscriptions, setAdminSubscriptions] = useState<AdminSubscription[]>([]);
  const [isPollingNow, setIsPollingNow] = useState(false);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [verifyingSubId, setVerifyingSubId] = useState<string | null>(null);
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<'all' | 'pending' | 'captured' | 'failed' | 'cod'>('all');
  const [orderFulfillmentFilter, setOrderFulfillmentFilter] = useState<string>('all');
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'active' | 'pending' | 'expired'>('all');
  const [loading, setLoading] = useState(true);

  // Newsletter Subscribers State
  const [newsletterSubscribers, setNewsletterSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [newsletterTotal, setNewsletterTotal] = useState<number>(0);
  const [newsletterActiveCount, setNewsletterActiveCount] = useState<number>(0);
  const [newsletterUnsubCount, setNewsletterUnsubCount] = useState<number>(0);
  const [newsletterSearch, setNewsletterSearch] = useState<string>('');
  const [newsletterStatusFilter, setNewsletterStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [newsletterPage, setNewsletterPage] = useState<number>(1);
  const [newsletterPages, setNewsletterPages] = useState<number>(1);
  const [loadingSubscribers, setLoadingSubscribers] = useState<boolean>(false);
  const [togglingSubscriberId, setTogglingSubscriberId] = useState<string | null>(null);

  // Discount Slider State (0% - 70%)
  const [discountSlider, setDiscountSlider] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('Seasonal promotional campaign');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  // Store Settings Form State
  const [settingsForm, setSettingsForm] = useState<{
    gst_rate: number;
    gst_mode: string;
    standard_shipping_fee: number;
    free_shipping_threshold: number;
    default_theme: string;
    admin_allow_cod: boolean;
    active_payment_gateway: 'razorpay' | 'payyantra';
  }>({
    gst_rate: 18,
    gst_mode: 'exclusive',
    standard_shipping_fee: 79,
    free_shipping_threshold: 1499,
    default_theme: 'white',
    admin_allow_cod: true,
    active_payment_gateway: 'razorpay',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    slug: '',
    description: '',
    material_care: '',
    sku_prefix: 'VNX-PR',
    base_price: 3999,
    sale_price: 2999,
    discount_percent: 25,
    gender: 'men',
    age_group: 'adults',
    category_id: '',
    brand_id: '',
    fabric: '100% Organic Pima Cotton',
    fit: 'Regular Fit',
    sleeve_length: 'Full Sleeve',
    occasion: 'Casual',
    season: 'All Season',
    is_featured: false,
    variants: [
      { size: 'M', color_name: 'Charcoal Black', color_hex: '#1A1A1A', sku: 'VNX-DEMO-M', stock_quantity: 15 },
      { size: 'L', color_name: 'Charcoal Black', color_hex: '#1A1A1A', sku: 'VNX-DEMO-L', stock_quantity: 12 },
    ],
    images: [
      { image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80', alt_text: 'Editorial Garment View', is_primary: true, display_order: 1 }
    ],
  });

  // Order Status Update State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>('confirmed');
  const [trackingNumber, setTrackingNumber] = useState<string>('BD-98214309');
  const [courierPartner, setCourierPartner] = useState<string>('Blue Dart Express');

  // Coupon Form State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_value: 1999,
    max_discount: 1000,
  });

  // Authorization check
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      error('Access restricted to administrators.');
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, o, c, b, cp, s, pl, poll, subs] = await Promise.all([
        api.admin.getMetrics(),
        api.admin.getOrders(),
        api.products.getCategories(),
        api.products.getBrands(),
        api.admin.getCoupons(),
        api.settings.getAdmin().catch(() => api.settings.getPublic()),
        api.subscriptions.getPlans(),
        api.admin.getPollingStatus().catch(() => null),
        api.subscriptions.getAllAdmin().catch(() => []),
        api.admin.getNewsletterSubscribers({ page: 1, limit: 15 }).catch(() => null),
      ]);
      setMetrics(m);
      setOrders(o);
      setCategories(c);
      setBrands(b);
      setCoupons(cp);
      setStoreSettings(s as any);
      setPlans(pl);
      setPollingStatus(poll);
      setAdminSubscriptions(subs || []);
      loadNewsletterSubscribers(1, 'all', '');
      setDiscountSlider(s.admin_global_discount || 0);
      setSettingsForm({
        gst_rate: s.gst_rate ?? 18,
        gst_mode: s.gst_mode || 'exclusive',
        standard_shipping_fee: s.standard_shipping_fee ?? 79,
        free_shipping_threshold: s.free_shipping_threshold ?? 1499,
        default_theme: s.default_theme || 'white',
        admin_allow_cod: (s as any).admin_allow_cod !== undefined ? Boolean((s as any).admin_allow_cod) : true,
        active_payment_gateway: ((s as any).active_payment_gateway === 'payyantra' ? 'payyantra' : 'razorpay') as 'razorpay' | 'payyantra',
      });
      if (c.length > 0 && !productForm.category_id) {
        setProductForm((prev) => ({ ...prev, category_id: c[0].id }));
      }
      if (b.length > 0 && !productForm.brand_id) {
        setProductForm((prev) => ({ ...prev, brand_id: b[0].id }));
      }
    } catch (err: any) {
      error(err.message || 'Error fetching admin records.');
    } finally {
      setLoading(false);
    }
  };

  const handlePollNow = async () => {
    setIsPollingNow(true);
    try {
      const res = await api.admin.pollNow();
      success(res.message || 'PayYantra polling reconciler triggered successfully!');
      // Refresh polling status and orders
      const [poll, ords, subs] = await Promise.all([
        api.admin.getPollingStatus().catch(() => null),
        api.admin.getOrders().catch(() => []),
        api.subscriptions.getAllAdmin().catch(() => []),
      ]);
      if (poll) setPollingStatus(poll);
      if (ords.length) setOrders(ords);
      if (subs.length) setAdminSubscriptions(subs);
    } catch (err: any) {
      error(err.message || 'Polling execution failed');
    } finally {
      setIsPollingNow(false);
    }
  };

  const handleRefreshOrderPayment = async (orderId: string) => {
    setVerifyingOrderId(orderId);
    try {
      const res = await api.admin.refreshOrderPayment(orderId);
      if (res.payment_status === 'captured') {
        success(`PayYantra verified payment as CAPTURED! Order ${res.order_number} marked paid.`);
      } else if (res.payment_status === 'failed') {
        info(`PayYantra reported transaction as FAILED.`);
      } else {
        info(`Current status from PayYantra gateway: ${res.payment_status}`);
      }
      loadData();
    } catch (err: any) {
      error(err.message || 'Payment status verification failed');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const handleRefreshSubscriptionPayment = async (subId: string) => {
    setVerifyingSubId(subId);
    try {
      const res = await api.subscriptions.refreshAdmin(subId);
      if (res.is_active) {
        success(`PayYantra verified subscription payment! ${res.plan_name} active.`);
      } else {
        info(`Gateway reported payment status: ${res.payment_status}`);
      }
      loadData();
    } catch (err: any) {
      error(err.message || 'Subscription verification failed');
    } finally {
      setVerifyingSubId(null);
    }
  };

  const loadNewsletterSubscribers = async (
    page = newsletterPage,
    status = newsletterStatusFilter,
    search = newsletterSearch
  ) => {
    setLoadingSubscribers(true);
    try {
      const res = await api.admin.getNewsletterSubscribers({
        page,
        limit: 15,
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
      });
      setNewsletterSubscribers(res.items);
      setNewsletterTotal(res.total);
      setNewsletterActiveCount(res.active_count);
      setNewsletterUnsubCount(res.unsubscribed_count);
      setNewsletterPage(res.page);
      setNewsletterPages(res.pages);
    } catch (err: any) {
      console.error('Error fetching subscribers:', err);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const handleToggleSubscriberStatus = async (subscriber: NewsletterSubscriber) => {
    const nextStatus = subscriber.status === 'active' ? 'unsubscribed' : 'active';
    setTogglingSubscriberId(subscriber.id);
    try {
      await api.admin.updateNewsletterSubscriberStatus(subscriber.id, nextStatus);
      success(`Subscriber ${subscriber.email} is now ${nextStatus}.`);
      await loadNewsletterSubscribers();
    } catch (err: any) {
      error(err.message || 'Could not update subscriber status.');
    } finally {
      setTogglingSubscriberId(null);
    }
  };

  const handleExportNewsletterCSV = async () => {
    try {
      const token = getAuthToken();
      const url = api.admin.exportNewsletterSubscribersUrl(
        newsletterStatusFilter === 'all' ? undefined : newsletterStatusFilter
      );
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed with HTTP ${res.status}`);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `varnyxa_subscribers_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      success('Subscribers CSV exported successfully!');
    } catch (err: any) {
      error(err.message || 'Could not export subscribers CSV.');
    }
  };

  const handleApplyDiscountSlider = async () => {
    setIsApplyingDiscount(true);
    try {
      const res = await api.settings.setDiscountSlider(discountSlider, discountReason);
      success(`Store promotional discount updated to ${res.discount_percent}%. Applied by ${res.applied_by}.`);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to update discount slider');
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const handleUpdateStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await api.settings.updateAdmin(settingsForm);
      success('Store business configuration updated in PostgreSQL!');
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to update store settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdatePlan = async (planId: string, price: number, duration_days: number) => {
    setSavingPlanId(planId);
    try {
      await api.subscriptions.updatePlan(planId, { price, duration_days });
      success('Subscription plan updated successfully!');
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to update plan');
    } finally {
      setSavingPlanId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProduct(true);
    try {
      await api.admin.createProduct(productForm);
      success(`Garment "${productForm.title}" added to real catalog!`);
      setIsProductModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Could not create product.');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    try {
      await api.admin.updateOrderStatus(selectedOrderId, {
        status: newStatus,
        tracking_number: trackingNumber,
        courier_partner: courierPartner,
      });
      success(`Order status updated to ${newStatus}.`);
      setSelectedOrderId(null);
      loadData();
    } catch (err: any) {
      error(err.message || 'Could not update status.');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createCoupon(couponForm);
      success(`Coupon "${couponForm.code.toUpperCase()}" launched!`);
      setIsCouponModalOpen(false);
      setCouponForm({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_value: 1999,
        max_discount: 1000,
      });
      loadData();
    } catch (err: any) {
      error(err.message || 'Could not create coupon.');
    }
  };

  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

  const handleSyncSeedCatalog = async () => {
    setIsSyncingCatalog(true);
    try {
      const res = await api.admin.importSeedCatalog();
      success(res.message || 'Authentic 24-garment wardrobe synced with 96 editorial photos!');
      loadData();
    } catch (err: any) {
      error(err.message || 'Catalog sync failed.');
    } finally {
      setIsSyncingCatalog(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-10">
      {/* Admin Header */}
      <div className="p-4 sm:p-8 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
            <ShieldCheck className="w-4 h-4" /> Protected Administrator Console
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-[var(--theme-text)] mt-1">
            VARNYXA Operations Portal
          </h1>
          <p className="text-xs text-[var(--theme-text-muted)]">
            Real-time PostgreSQL metrics, inventory control, and fulfillment tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={loadData}
            className="p-2.5 sm:p-3 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl sm:rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer text-[var(--theme-text)]"
            aria-label="Refresh metrics"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--theme-text)] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSyncSeedCatalog}
            disabled={isSyncingCatalog}
            className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold uppercase tracking-wider rounded-xl sm:rounded-2xl hover:bg-[var(--theme-primary)] hover:text-[var(--theme-primary-contrast)] transition flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            title="Re-sync initial authentic 24-piece fashion collection and 96 photos"
          >
            <Sparkles className={`w-4 h-4 text-[var(--theme-primary)] ${isSyncingCatalog ? 'animate-spin' : ''}`} />
            <span>{isSyncingCatalog ? 'Syncing...' : 'Sync Wardrobe'}</span>
          </button>
          <button
            onClick={() => setIsProductModalOpen(true)}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl sm:rounded-2xl hover:opacity-90 transition flex items-center gap-1.5 sm:gap-2 shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Garment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--theme-border)] overflow-x-auto no-scrollbar gap-2 sm:gap-6 text-xs uppercase tracking-wider font-semibold -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
            activeTab === 'metrics' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Real Analytics
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'orders' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Package className="w-4 h-4" /> Client Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'subscriptions' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)] font-bold' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-500" /> VIP Subscriptions ({adminSubscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'coupons' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Tag className="w-4 h-4" /> Promotional Coupons ({coupons.length})
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'discounts' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)] font-bold' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Sliders className="w-4 h-4" /> Discount Slider ({discountSlider}%)
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'settings' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)] font-bold' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <SettingsIcon className="w-4 h-4" /> Store Rules & VIP Plans
        </button>
        <button
          onClick={() => {
            setActiveTab('newsletter');
            loadNewsletterSubscribers(1, newsletterStatusFilter, newsletterSearch);
          }}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'newsletter' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)] font-bold' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Mail className="w-4 h-4 text-emerald-500" /> Newsletter Club ({newsletterTotal})
        </button>
      </div>

      {/* Tab: Real Analytics & Metrics */}
      {activeTab === 'metrics' && metrics && (
        <div className="space-y-8">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C887B] block">Gross Revenue</span>
              <p className="font-serif text-3xl font-extrabold text-[#121212]">{formatPrice(metrics.total_sales)}</p>
              <span className="text-[10px] text-emerald-800 font-medium">Non-cancelled order totals</span>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C887B] block">Total Orders</span>
              <p className="font-serif text-3xl font-extrabold text-[#121212]">{metrics.total_orders}</p>
              <span className="text-[10px] text-[#8C887B]">{metrics.pending_orders} pending dispatch</span>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C887B] block">Catalog Garments</span>
              <p className="font-serif text-3xl font-extrabold text-[#121212]">{metrics.total_products}</p>
              <span className="text-[10px] text-emerald-800 font-medium">Active database models</span>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C887B] block">Low Stock Alerts</span>
              <p className="font-serif text-3xl font-extrabold text-[#D9534F]">{metrics.low_stock_count}</p>
              <span className="text-[10px] text-[#D9534F] font-medium">Variants below 5 units</span>
            </div>
          </div>

          {/* Recent Orders Overview */}
          <div className="p-6 sm:p-8 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#121212] uppercase tracking-wider">
              Recent Transactions
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F6] text-[#8C887B] uppercase tracking-wider font-semibold border-b border-[#E8E6E1]">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA] text-[#121212]">
                  {metrics.recent_orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#FAF9F6] transition">
                      <td className="py-3 px-4 font-mono font-bold">{o.order_number}</td>
                      <td className="py-3 px-4 text-[#6E6B64]">{formatDate(o.created_at)}</td>
                      <td className="py-3 px-4 font-medium">{o.shipping_address?.full_name || 'Client'}</td>
                      <td className="py-3 px-4 font-bold">{formatPrice(o.total_amount)}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#121212] text-[#C5A880]">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setSelectedOrderId(o.id);
                            setNewStatus(o.status);
                          }}
                          className="text-xs text-[#C5A880] hover:text-[#121212] font-bold"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Orders Management */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* PayYantra Automated Polling Service Health Card */}
          <div className="p-5 sm:p-6 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--theme-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif text-sm font-bold text-[var(--theme-text)]">
                      Automated PayYantra Polling Worker
                    </h4>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        pollingStatus?.is_gateway_configured
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {pollingStatus?.is_gateway_configured ? 'PayYantra Gateway Active' : 'Credentials Missing in .env'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                    Periodic background reconciler queries PayYantra status APIs every {pollingStatus?.interval_seconds || 60}s. Safe idempotency guarantees zero duplicate processing.
                  </p>
                </div>
              </div>

              <button
                onClick={handlePollNow}
                disabled={isPollingNow}
                className="px-4 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPollingNow ? 'animate-spin' : ''}`} />
                <span>{isPollingNow ? 'Querying PayYantra...' : 'Poll Gateway Now'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] block">Last Polled Time</span>
                <span className="font-mono font-semibold text-[var(--theme-text)] truncate block">
                  {pollingStatus?.last_polled_at ? formatDate(pollingStatus.last_polled_at) : 'Active / In Progress'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] block">Orders Checked / Synced</span>
                <span className="font-mono font-semibold text-[var(--theme-text)]">
                  {pollingStatus?.orders_checked ?? 0} checked • {pollingStatus?.orders_updated ?? 0} updated
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] block">Subscriptions Checked</span>
                <span className="font-mono font-semibold text-[var(--theme-text)]">
                  {pollingStatus?.subscriptions_checked ?? 0} checked • {pollingStatus?.subscriptions_updated ?? 0} activated
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] block">Last Polling Error</span>
                <span className={`text-[11px] truncate block ${pollingStatus?.last_error ? 'text-amber-600 font-semibold' : 'text-emerald-600'}`}>
                  {pollingStatus?.last_error ? pollingStatus.last_error : 'Clean (0 errors)'}
                </span>
              </div>
            </div>
          </div>

          {/* Orders Table & Filters */}
          <div className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E8E6E1]">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#121212] uppercase tracking-wider">
                  Client Orders ({orders.length})
                </h3>
                <p className="text-xs text-[#8C887B]">
                  Payment status is verified strictly by PayYantra. Fulfillment status is updated upon atelier dispatch.
                </p>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#8C887B]">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase text-[10px]">Payment:</span>
                </div>
                <select
                  value={orderPaymentFilter}
                  onChange={(e) => setOrderPaymentFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-semibold"
                >
                  <option value="all">All Payments</option>
                  <option value="pending">Pending Payment</option>
                  <option value="captured">Verified Paid (Captured)</option>
                  <option value="failed">Failed / Cancelled</option>
                  <option value="cod">COD (Admin Internal)</option>
                </select>

                <div className="flex items-center gap-1.5 text-xs text-[#8C887B] ml-2">
                  <span className="font-semibold uppercase text-[10px]">Fulfillment:</span>
                </div>
                <select
                  value={orderFulfillmentFilter}
                  onChange={(e) => setOrderFulfillmentFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-semibold"
                >
                  <option value="all">All Fulfillments</option>
                  <option value="placed">Placed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing in Atelier</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F6] text-[#8C887B] uppercase tracking-wider font-semibold border-b border-[#E8E6E1]">
                  <tr>
                    <th className="py-3 px-4">Order # & Date</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Garments</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Fulfillment Status</th>
                    <th className="py-3 px-4">Logistics / Tracking</th>
                    <th className="py-3 px-4">Safe Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA] text-[#121212]">
                  {orders
                    .filter((o) => {
                      const p = o.payments?.[0];
                      const pStatus = p?.status || 'pending';
                      const pProvider = p?.provider;
                      if (orderPaymentFilter === 'cod') {
                        if (pProvider !== 'cod') return false;
                      } else if (orderPaymentFilter !== 'all') {
                        if (pStatus !== orderPaymentFilter) return false;
                      }
                      if (orderFulfillmentFilter !== 'all' && o.status !== orderFulfillmentFilter) return false;
                      return true;
                    })
                    .map((o) => {
                      const payment = o.payments?.[0];
                      const isVerifying = verifyingOrderId === o.id;

                      return (
                        <tr key={o.id} className="hover:bg-[#FAF9F6] transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold block">{o.order_number}</span>
                            <span className="text-[10px] text-[#8C887B] block">{formatDate(o.created_at)}</span>
                          </td>
                          <td className="py-3 px-4 text-[#6E6B64]">
                            <span className="font-medium text-[#121212] block">{o.shipping_address?.full_name || 'Client'}</span>
                            <span className="text-[11px] block">{o.shipping_address?.city}, {o.shipping_address?.state}</span>
                          </td>
                          <td className="py-3 px-4">{o.items.length} pcs</td>
                          <td className="py-3 px-4 font-bold">{formatPrice(o.total_amount)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block ${
                                payment?.status === 'captured'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : payment?.status === 'failed'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {payment?.status === 'captured' ? 'Captured (Paid)' : payment?.status || 'Pending'}
                            </span>
                            {payment?.provider === 'cod' ? (
                              <span className="text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mt-1">
                                COD (Admin Internal)
                              </span>
                            ) : payment?.provider === 'payyantra' ? (
                              <span className="text-[9px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mt-1">
                                PayYantra V3
                              </span>
                            ) : null}
                            {(o.payment_reference_id || payment?.reference_id) && (
                              <span className="font-mono text-[9px] text-[#8C887B] block mt-0.5">
                                Ref: {o.payment_reference_id || payment?.reference_id}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#121212] text-[#C5A880] inline-block">
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-[#6E6B64]">
                            <span className="font-medium text-[#121212] block">{o.courier_partner || 'Awaiting'}</span>
                            <span className="text-[10px] block">{o.tracking_number || 'Pending assignment'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {/* Safe manual gateway verification */}
                              <button
                                onClick={() => handleRefreshOrderPayment(o.id)}
                                disabled={isVerifying}
                                title="Safely queries PayYantra status API and updates database"
                                className="px-2.5 py-1 bg-white border border-[#E8E6E1] text-[#121212] text-[10px] font-bold rounded-lg hover:bg-[#FAF9F6] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />
                                <span>{isVerifying ? 'Checking...' : 'Verify Gateway'}</span>
                              </button>

                              {/* Fulfillment status manager */}
                              <button
                                onClick={() => {
                                  setSelectedOrderId(o.id);
                                  setNewStatus(o.status);
                                  setCourierPartner(o.courier_partner || 'Blue Dart Express');
                                  setTrackingNumber(o.tracking_number || 'BD-98214309');
                                }}
                                className="px-2.5 py-1 bg-[#121212] text-white text-[10px] font-semibold rounded-lg hover:bg-black transition cursor-pointer"
                              >
                                Fulfillment
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Subscriptions Management */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E8E6E1]">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                  <Crown className="w-4 h-4 text-amber-500" /> VARNYXA Privé Memberships
                </div>
                <h3 className="font-serif text-lg font-bold text-[#121212] mt-1">
                  Client VIP Subscription Purchases ({adminSubscriptions.length})
                </h3>
                <p className="text-xs text-[#8C887B]">
                  Activated strictly after PayYantra gateway payment capture. Background reconciler continuously polls pending subscription references.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8C887B] font-semibold uppercase text-[10px]">Filter:</span>
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-semibold"
                >
                  <option value="all">All Subscriptions</option>
                  <option value="active">Active Memberships</option>
                  <option value="pending">Pending Payment</option>
                  <option value="expired">Expired / Inactive</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F6] text-[#8C887B] uppercase tracking-wider font-semibold border-b border-[#E8E6E1]">
                  <tr>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Plan Tier</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Membership Status</th>
                    <th className="py-3 px-4">Start / Expiry</th>
                    <th className="py-3 px-4">Gateway Reference</th>
                    <th className="py-3 px-4">Polling & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA] text-[#121212]">
                  {adminSubscriptions
                    .filter((sub) => {
                      if (subStatusFilter === 'all') return true;
                      if (subStatusFilter === 'active') return sub.status === 'active' && sub.payment_status === 'captured';
                      if (subStatusFilter === 'pending') return sub.payment_status === 'pending' || sub.status === 'pending';
                      if (subStatusFilter === 'expired') return sub.status === 'expired' || sub.payment_status === 'failed';
                      return true;
                    })
                    .map((sub) => {
                      const isVerifying = verifyingSubId === sub.id;

                      return (
                        <tr key={sub.id} className="hover:bg-[#FAF9F6] transition">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-[#121212] block">{sub.user_name || 'VIP Client'}</span>
                            <span className="text-[11px] text-[#8C887B] block truncate max-w-[160px]">{sub.user_email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold block">{sub.plan_name}</span>
                            <span className="text-[10px] text-[#8C887B] uppercase block">
                              {sub.days_remaining > 0 ? `${sub.days_remaining}d remaining` : 'Expired'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-[var(--theme-primary)]">
                            {formatPrice(sub.amount_paid)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block ${
                                sub.payment_status === 'captured'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : sub.payment_status === 'failed'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {sub.payment_status === 'captured' ? 'Captured (Paid)' : sub.payment_status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block ${
                                sub.status === 'active' && sub.payment_status === 'captured'
                                  ? 'bg-[#121212] text-[#C5A880]'
                                  : 'bg-[#FAF9F6] text-[#8C887B] border border-[#E8E6E1]'
                              }`}
                            >
                              {sub.status === 'active' && sub.payment_status === 'captured' ? 'Active Member' : sub.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#6E6B64]">
                            <span className="block text-[11px]">Start: {formatDate(sub.start_date)}</span>
                            <span className="block text-[11px] font-semibold text-[#121212]">Expires: {formatDate(sub.expiry_date)}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-[#6E6B64]">
                            <span className="block">Ref: {sub.payment_reference || 'N/A'}</span>
                            {sub.payyantra_order_id && (
                              <span className="block text-[#8C887B]">PY Order: {sub.payyantra_order_id}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleRefreshSubscriptionPayment(sub.id)}
                              disabled={isVerifying}
                              title="Safely verifies PayYantra Hosted checkout status and updates DB"
                              className="px-2.5 py-1 bg-white border border-[#E8E6E1] text-[#121212] text-[10px] font-bold rounded-lg hover:bg-[#FAF9F6] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />
                              <span>{isVerifying ? 'Checking...' : 'Verify Gateway'}</span>
                            </button>
                            {sub.poll_count > 0 && (
                              <span className="text-[9px] text-[#8C887B] block mt-1">
                                Polled {sub.poll_count}x
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Coupons Management */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-lg font-bold text-[#121212]">Active Promotional Coupons</h3>
            <button
              onClick={() => setIsCouponModalOpen(true)}
              className="px-4 py-2 bg-[#121212] text-white text-xs font-bold uppercase rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Coupon
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {coupons.map((c) => (
              <div key={c.id} className="p-6 bg-white rounded-3xl border border-[#E8E6E1] shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="px-3 py-1 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-mono text-sm font-bold text-[#121212]">
                    {c.code}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                    Active
                  </span>
                </div>
                <p className="text-xs text-[#6E6B64]">{c.description}</p>
                <div className="pt-2 border-t border-[#F0EFEA] text-xs text-[#8C887B] space-y-1">
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <strong className="text-[#121212]">
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Order:</span>
                    <strong className="text-[#121212]">{formatPrice(c.min_order_value)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Times Redeemed:</span>
                    <strong className="text-[#121212]">{c.times_used}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Discount Slider (0% - 70%) */}
      {activeTab === 'discounts' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--theme-border)]">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                  <Percent className="w-4 h-4" /> Real-time Price Modulation
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[var(--theme-text)] mt-1">
                  Admin-Controlled Discount Slider
                </h3>
                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                  Adjust and publish storewide promotional discounts directly to PostgreSQL. Calculations are strictly executed on the backend.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--theme-text-muted)] font-mono">
                  PostgreSQL Active: <strong>{storeSettings?.admin_global_discount ?? 0}%</strong>
                </span>
              </div>
            </div>

            {/* Visual Readout Display */}
            <div className="p-6 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-center sm:text-left">
                <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider block">
                  Configured Promotional Rate
                </span>
                <div className="text-5xl font-extrabold text-[var(--theme-primary)] font-mono mt-1">
                  {discountSlider}%
                </div>
                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                  {discountSlider === 0
                    ? 'No storewide discount active. Regular catalogue prices apply.'
                    : `Customers save ${discountSlider}% on all eligible garments in cart and checkout.`}
                </p>
              </div>

              <div className="flex flex-col items-center sm:items-end gap-2">
                <span
                  className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                    discountSlider > 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-[var(--theme-border)] text-[var(--theme-text-muted)]'
                  }`}
                >
                  {discountSlider > 0 ? 'Discount Active' : 'Zero Discount'}
                </span>
                <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                  Allowed Range: 0% – 70% Max
                </span>
              </div>
            </div>

            {/* Slider & Numeric Input Controls */}
            <div className="space-y-6 pt-2">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
                    Drag Slider to Adjust Percentage
                  </label>
                  <span className="text-xs font-mono font-bold text-[var(--theme-primary)]">
                    {discountSlider}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="70"
                  step="1"
                  value={discountSlider}
                  onChange={(e) => setDiscountSlider(Number(e.target.value))}
                  className="w-full h-3 bg-[var(--theme-bg)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)] border border-[var(--theme-border)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--theme-text-muted)] mt-1 font-mono">
                  <span>0% (Standard)</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>70% (Maximum Cap)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                    Precise Percentage Entry (0 - 70)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="70"
                    value={discountSlider}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(70, Number(e.target.value)));
                      setDiscountSlider(val);
                    }}
                    className="w-full px-3.5 py-2.5 bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                    Audit Note / Campaign Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Autumn Wardrobe Refresh"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--theme-border)]">
                <p className="text-xs text-[var(--theme-text-muted)] max-w-md">
                  Changes take effect immediately on all customer cart calculations and checkout order summaries without requiring frontend redeployment.
                </p>

                <button
                  onClick={handleApplyDiscountSlider}
                  disabled={isApplyingDiscount}
                  className="w-full sm:w-auto px-8 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isApplyingDiscount ? 'Publishing to DB...' : `Apply ${discountSlider}% Discount`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Store Rules & VIP Plans */}
      {activeTab === 'settings' && (
        <div className="space-y-8">
          {/* Business Rules Form */}
          <form onSubmit={handleUpdateStoreSettings} className="p-6 sm:p-8 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
              <SettingsIcon className="w-4 h-4" /> Authoritative Store Configuration
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[var(--theme-text)]">
              Tax, Shipping, and Business Rules
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)]">
              Authoritative parameters stored in the `store_settings` PostgreSQL table. All cart, checkout, and invoices adhere to these values.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Delivery Fee */}
              <div className="p-5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
                  <Truck className="w-4 h-4 text-[var(--theme-primary)]" /> Delivery Rules
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                    Standard Delivery Fee (₹)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={settingsForm.standard_shipping_fee}
                    onChange={(e) => setSettingsForm({ ...settingsForm, standard_shipping_fee: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono"
                  />
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
                    Default: ₹79 for orders below threshold.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                    Free Delivery Threshold (₹)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={settingsForm.free_shipping_threshold}
                    onChange={(e) => setSettingsForm({ ...settingsForm, free_shipping_threshold: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono"
                  />
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
                    Default: ₹1,499. Orders equal or above qualify for FREE shipping.
                  </p>
                </div>
              </div>

              {/* Tax Settings */}
              <div className="p-5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
                  <DollarSign className="w-4 h-4 text-[var(--theme-primary)]" /> GST & Tax Billing
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                    GST Rate Percentage (%)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    max="40"
                    step="0.5"
                    value={settingsForm.gst_rate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, gst_rate: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono"
                  />
                  <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
                    Default: 18% GST itemized transparently in checkout and invoice.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                    GST Price Mode
                  </label>
                  <select
                    value={settingsForm.gst_mode}
                    onChange={(e) => setSettingsForm({ ...settingsForm, gst_mode: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-semibold"
                  >
                    <option value="exclusive">Exclusive (Tax added transparently on subtotal)</option>
                    <option value="inclusive">Inclusive (Catalogue prices already include GST)</option>
                  </select>
                </div>
              </div>

              {/* Internal Payment Controls */}
              <div className="p-5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
                    <Shield className="w-4 h-4 text-[var(--theme-primary)]" /> Internal Payment Methods (Admin Operations)
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded uppercase tracking-wider">
                    Admin Only
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)]">
                  <div className="pr-4">
                    <h5 className="text-xs font-bold text-[var(--theme-text)]">
                      Cash on Delivery (COD) Administrative Option
                    </h5>
                    <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5">
                      Enable or disable internal Cash on Delivery for authorized admin order placements. Customers are strictly restricted from selecting or submitting COD orders.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settingsForm.admin_allow_cod}
                      onChange={(e) => setSettingsForm({ ...settingsForm, admin_allow_cod: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Online Payment Gateway Selection */}
              <div className="p-5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
                    <CreditCard className="w-4 h-4 text-[var(--theme-primary)]" /> Primary Online Payment Gateway Engine
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded uppercase tracking-wider">
                    Customer Engine
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)] space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--theme-text)] mb-1">
                      Active Customer Payment Provider
                    </label>
                    <select
                      value={settingsForm.active_payment_gateway}
                      onChange={(e) => setSettingsForm({ ...settingsForm, active_payment_gateway: e.target.value as 'razorpay' | 'payyantra' })}
                      className="w-full px-3.5 py-2 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-semibold"
                    >
                      <option value="razorpay">
                        Razorpay — Direct In-Page Checkout (Method-Specific UPI QR & Card Form)
                      </option>
                      <option value="payyantra">
                        PayYantra — Hosted Checkout V3 Gateway
                      </option>
                    </select>
                    <p className="text-[11px] text-[var(--theme-text-muted)] mt-1.5 leading-relaxed">
                      {settingsForm.active_payment_gateway === 'razorpay'
                        ? 'Razorpay operates directly within the checkout page. Selecting UPI opens the UPI flow / dynamic QR; selecting Cards opens the secure card form directly without redirecting to a generic merchant portal.'
                        : 'PayYantra Hosted Checkout V3 initiates via PayYantra Payin API. Customer is presented with PayYantra\'s verified checkout session.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[var(--theme-border)]">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-8 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSavingSettings ? 'Saving...' : 'Save Business Settings'}
              </button>
            </div>
          </form>

          {/* Subscription Plans Management */}
          <div className="p-6 sm:p-8 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
              <Crown className="w-4 h-4" /> VARNYXA Privé Tiers
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[var(--theme-text)]">
              Subscription Membership Plans
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)]">
              Modify VIP tier pricing and durations stored in PostgreSQL. Members automatically enjoy ₹0 shipping on all orders.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="p-6 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--theme-text)]">{plan.name}</h4>
                    <span className="font-mono text-xs text-[var(--theme-text-muted)] uppercase">{plan.code}</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                        Price (₹)
                      </label>
                      <input
                        type="number"
                        min="1"
                        defaultValue={plan.price}
                        id={`price-${plan.id}`}
                        className="w-full px-3 py-1.5 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">
                        Duration (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        defaultValue={plan.duration_days}
                        id={`duration-${plan.id}`}
                        className="w-full px-3 py-1.5 text-xs bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const priceInput = document.getElementById(`price-${plan.id}`) as HTMLInputElement;
                      const durInput = document.getElementById(`duration-${plan.id}`) as HTMLInputElement;
                      if (priceInput && durInput) {
                        handleUpdatePlan(plan.id, Number(priceInput.value), Number(durInput.value));
                      }
                    }}
                    disabled={savingPlanId === plan.id}
                    className="w-full py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingPlanId === plan.id ? 'Updating...' : 'Save Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Newsletter Subscribers */}
      {activeTab === 'newsletter' && (
        <div className="space-y-6">
          {/* Header & Metric Bar */}
          <div className="p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--theme-primary)]">
                  <Mail className="w-4 h-4" /> Marketing Consent Ledger
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-extrabold text-[var(--theme-text)] mt-1">
                  VARNYXA Club Subscribers
                </h2>
                <p className="text-xs text-[var(--theme-text-muted)]">
                  Real PostgreSQL-verified subscribers with explicit timestamped consent. Zero fabricated emails.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadNewsletterSubscribers(newsletterPage, newsletterStatusFilter, newsletterSearch)}
                  className="p-2.5 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-xl text-[var(--theme-text)] hover:bg-[var(--theme-surface-alt)] transition"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSubscribers ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleExportNewsletterCSV}
                  className="px-4 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
                  Total Club Registrations
                </span>
                <p className="text-2xl font-serif font-extrabold text-[var(--theme-text)]">
                  {newsletterTotal}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Active Opted-In Members
                </span>
                <p className="text-2xl font-serif font-extrabold text-emerald-700 dark:text-emerald-300">
                  {newsletterActiveCount}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-500/10 border border-zinc-500/20 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
                  Unsubscribed Contacts
                </span>
                <p className="text-2xl font-serif font-extrabold text-[var(--theme-text)]">
                  {newsletterUnsubCount}
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[var(--theme-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search email address..."
                value={newsletterSearch}
                onChange={(e) => setNewsletterSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadNewsletterSubscribers(1, newsletterStatusFilter, newsletterSearch);
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-xl text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {(['all', 'active', 'unsubscribed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setNewsletterStatusFilter(st);
                    loadNewsletterSubscribers(1, st, newsletterSearch);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                    newsletterStatusFilter === st
                      ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] shadow-sm'
                      : 'bg-[var(--theme-surface)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Subscribers Table */}
          <div className="bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm overflow-hidden">
            {loadingSubscribers ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--theme-primary)]" />
                <p className="text-xs text-[var(--theme-text-muted)]">Loading subscribers from PostgreSQL...</p>
              </div>
            ) : newsletterSubscribers.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--theme-text-muted)] space-y-1">
                <p className="font-semibold text-sm text-[var(--theme-text)]">No subscribers found</p>
                <p>New signups through "Join the VARNYXA Club" will appear here in real time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-bg)] border-b border-[var(--theme-border)] text-[var(--theme-text-muted)] uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Email Address</th>
                      <th className="px-5 py-3.5">Subscription Status</th>
                      <th className="px-5 py-3.5">Consent Recorded At</th>
                      <th className="px-5 py-3.5">Source</th>
                      <th className="px-5 py-3.5">Created Date</th>
                      <th className="px-5 py-3.5 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]">
                    {newsletterSubscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                        <td className="px-5 py-4 font-semibold text-[var(--theme-text)]">
                          {sub.email}
                        </td>
                        <td className="px-5 py-4">
                          {sub.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                              <X className="w-3 h-3" />
                              Unsubscribed
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-[var(--theme-text-muted)] font-mono text-[11px]">
                          {sub.consent_at ? new Date(sub.consent_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-4 text-[var(--theme-text-muted)] capitalize">
                          {sub.source || 'website'}
                        </td>
                        <td className="px-5 py-4 text-[var(--theme-text-muted)] font-mono text-[11px]">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleToggleSubscriberStatus(sub)}
                            disabled={togglingSubscriberId === sub.id}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition ${
                              sub.status === 'active'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {togglingSubscriberId === sub.id
                              ? 'Updating...'
                              : sub.status === 'active'
                              ? 'Deactivate'
                              : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {newsletterPages > 1 && (
              <div className="p-4 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-text-muted)]">
                <span>
                  Page {newsletterPage} of {newsletterPages} ({newsletterTotal} total subscribers)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadNewsletterSubscribers(newsletterPage - 1, newsletterStatusFilter, newsletterSearch)}
                    disabled={newsletterPage <= 1 || loadingSubscribers}
                    className="px-3 py-1 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => loadNewsletterSubscribers(newsletterPage + 1, newsletterStatusFilter, newsletterSearch)}
                    disabled={newsletterPage >= newsletterPages || loadingSubscribers}
                    className="px-3 py-1 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 space-y-6 relative border border-[#E8E6E1] shadow-2xl my-8">
            <button
              onClick={() => setIsProductModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-[#8C887B] hover:text-[#121212]"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#121212]">Publish Real Garment to Catalog</h3>
              <p className="text-xs text-[#8C887B] mt-0.5">Saves directly into PostgreSQL `products` and `product_variants` tables.</p>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Title</label>
                  <input
                    required
                    type="text"
                    value={productForm.title}
                    onChange={(e) => setProductForm({ ...productForm, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Slug (URL)</label>
                  <input
                    required
                    type="text"
                    value={productForm.slug}
                    onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Base Price (₹)</label>
                  <input
                    required
                    type="number"
                    value={productForm.base_price}
                    onChange={(e) => setProductForm({ ...productForm, base_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sale Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.sale_price}
                    onChange={(e) => setProductForm({ ...productForm, sale_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Discount %</label>
                  <input
                    type="number"
                    value={productForm.discount_percent}
                    onChange={(e) => setProductForm({ ...productForm, discount_percent: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Gender</label>
                  <select
                    value={productForm.gender}
                    onChange={(e) => setProductForm({ ...productForm, gender: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  >
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="unisex">Unisex</option>
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                    <option value="baby">Baby</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Age Group</label>
                  <select
                    value={productForm.age_group}
                    onChange={(e) => setProductForm({ ...productForm, age_group: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  >
                    <option value="adults">Adults</option>
                    <option value="teens">Teens</option>
                    <option value="kids">Kids</option>
                    <option value="toddler">Toddler</option>
                    <option value="infant">Infant</option>
                    <option value="newborn">Newborn</option>
                    <option value="seniors">Seniors</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block font-semibold mb-1">Image URL (Unsplash or CDN)</label>
                <input
                  required
                  type="url"
                  value={productForm.images[0].image_url}
                  onChange={(e) => setProductForm({
                    ...productForm,
                    images: [{ ...productForm.images[0], image_url: e.target.value }]
                  })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-mono text-[11px]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 border border-[#E8E6E1] text-[#121212] font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="px-6 py-2.5 bg-[#121212] text-white font-bold uppercase rounded-xl hover:bg-black transition shadow-lg"
                >
                  {isSubmittingProduct ? 'Saving...' : 'Publish to Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Status Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 relative border border-[#E8E6E1] shadow-2xl">
            <button
              onClick={() => setSelectedOrderId(null)}
              className="absolute top-4 right-4 p-1 text-[#8C887B]"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-lg font-bold text-[#121212]">Update Fulfillment & Dispatch</h3>
            <p className="text-[11px] text-[#8C887B]">
              Payment status is verified strictly by PayYantra. Update courier logistics and fulfillment milestones below.
            </p>
            <form onSubmit={handleUpdateOrderStatus} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Fulfillment Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-semibold capitalize"
                >
                  <option value="placed">Placed</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing in Atelier</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Courier Partner</label>
                <input
                  type="text"
                  value={courierPartner}
                  onChange={(e) => setCourierPartner(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Tracking Number / AWB</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#121212] text-white font-bold uppercase rounded-xl hover:bg-black"
              >
                Save Status
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Coupon Creation Modal */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 relative border border-[#E8E6E1] shadow-2xl">
            <button
              onClick={() => setIsCouponModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-[#8C887B]"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-lg font-bold text-[#121212]">Create Promotional Coupon</h3>
            <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Coupon Code (Uppercase)</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SUMMER25"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl uppercase font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <input
                  required
                  type="text"
                  placeholder="25% off on summer linen collection"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Discount Type</label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Discount Value</label>
                  <input
                    required
                    type="number"
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Minimum Order Value (₹)</label>
                <input
                  required
                  type="number"
                  value={couponForm.min_order_value}
                  onChange={(e) => setCouponForm({ ...couponForm, min_order_value: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#121212] text-white font-bold uppercase rounded-xl hover:bg-black mt-2"
              >
                Launch Coupon
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
