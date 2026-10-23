import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Package,
  MapPin,
  Heart,
  Lock,
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
  ArrowRight,
  ShoppingBag,
  Crown,
  Sparkles,
  AlertCircle,
  CreditCard,
  Truck,
  CheckCircle2,
  RotateCw,
  RefreshCw,
  XCircle,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Order, Address, UserSubscription } from '../types';
import { api } from '../services/api';
import { formatPrice, formatDate } from '../utils/formatters';

export const AccountPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'orders';
  const { user, updateUser, logout } = useAuth();
  const { wishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [retryingPaymentOrderId, setRetryingPaymentOrderId] = useState<string | null>(null);
  const [isVerifyingSub, setIsVerifyingSub] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);

  const loadSubscription = async () => {
    try {
      const sub = await api.subscriptions.getMySubscription();
      setSubscription(sub);
    } catch {
      setSubscription(null);
    }
  };

  const handleVerifySubscription = async (subId: string) => {
    setIsVerifyingSub(true);
    try {
      const res = await api.subscriptions.getStatus(subId);
      if (res.is_active) {
        success('Privé Membership verified and activated!');
      } else if (res.payment_status === 'pending') {
        info('Payment status is still pending at PayYantra gateway.');
      } else {
        error(`Gateway reported status: ${res.payment_status}`);
      }
      loadSubscription();
    } catch (err: any) {
      error(err.message || 'Status lookup failed');
    } finally {
      setIsVerifyingSub(false);
    }
  };

  const getEffectivePayment = (o: Order) => {
    if (!o.payments || o.payments.length === 0) return null;
    const successful = o.payments.find(
      (p) => p.status === 'captured' || p.status === 'demo_completed'
    );
    if (successful) return successful;
    return [...o.payments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const getPaymentStatusBadge = (status?: string, provider?: string) => {
    if (status === 'demo_completed' || provider === 'demo') {
      return {
        label: 'Demo Completed',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
        icon: CheckCircle2,
      };
    }
    switch (status) {
      case 'captured':
        return {
          label: 'Payment Verified',
          className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          icon: CheckCircle2,
        };
      case 'failed':
        return {
          label: 'Payment Failed',
          className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
          icon: AlertCircle,
        };
      case 'refunded':
        return {
          label: 'Refunded',
          className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
          icon: RotateCw,
        };
      case 'pending':
      default:
        return {
          label: 'Pending Payment',
          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
          icon: Clock,
        };
    }
  };

  const getFulfillmentStatusBadge = (status: string, isDemo?: boolean) => {
    switch (status) {
      case 'placed':
        return {
          label: 'Order Placed',
          className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        };
      case 'confirmed':
        return {
          label: isDemo ? 'Order Confirmed (Demo)' : 'Payment Confirmed',
          className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
        };
      case 'processing':
        return {
          label: 'Processing in Atelier',
          className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
        };
      case 'shipped':
        return {
          label: 'Shipped',
          className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
        };
      case 'out_for_delivery':
        return {
          label: 'Out for Delivery',
          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
        };
      default:
        return {
          label: status,
          className: 'bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)]',
        };
    }
  };

  const getOrderStage = (orderStatus: string, paymentStatus?: string, provider?: string): number => {
    if (orderStatus === 'cancelled') return -1;
    if (orderStatus === 'delivered') return 6;
    if (orderStatus === 'out_for_delivery') return 5;
    if (orderStatus === 'shipped') return 4;
    if (orderStatus === 'processing') return 3;
    if (orderStatus === 'confirmed' || paymentStatus === 'captured' || paymentStatus === 'demo_completed' || provider === 'demo') return 2;
    return 1;
  };

  // Edit Profile Form state
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Change Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Address creation form
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    address_type: 'Home',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/account');
      return;
    }
    setProfileName(user.full_name);
    setProfilePhone(user.phone || '');

    // Load active subscription
    loadSubscription();
  }, [user, navigate]);

  // Load orders
  useEffect(() => {
    if (currentTab === 'orders' && user) {
      setLoadingOrders(true);
      api.orders
        .list()
        .then((res) => setOrders(res))
        .catch((err) => console.error('Fetch orders error:', err))
        .finally(() => setLoadingOrders(false));
    }
  }, [currentTab, user]);

  // Load subscription if membership tab opened
  useEffect(() => {
    if (currentTab === 'membership' && user) {
      loadSubscription();
    }
  }, [currentTab, user]);

  // Load addresses
  useEffect(() => {
    if (currentTab === 'addresses' && user) {
      setLoadingAddresses(true);
      api.addresses
        .list()
        .then((res) => setAddresses(res))
        .catch((err) => console.error('Fetch addresses error:', err))
        .finally(() => setLoadingAddresses(false));
    }
  }, [currentTab, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const updated = await api.auth.updateProfile({ full_name: profileName, phone: profilePhone });
      updateUser(updated);
      success('Profile updated successfully.');
    } catch (err: any) {
      error(err.message || 'Profile update failed.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    try {
      await api.auth.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      success('Password changed successfully.');
    } catch (err: any) {
      error(err.message || 'Password update failed.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.addresses.create(newAddr);
      setAddresses([...addresses, created]);
      setIsAddingAddress(false);
      setNewAddr({
        full_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        address_type: 'Home',
      });
      success('New shipping address saved.');
    } catch (err: any) {
      error(err.message || 'Could not save address.');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.addresses.delete(id);
      setAddresses(addresses.filter((a) => a.id !== id));
      success('Address removed.');
    } catch (err: any) {
      error(err.message || 'Could not delete address.');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt('Please provide a reason for cancelling this order:');
    if (!reason || !reason.trim()) return;

    try {
      const cancelled = await api.orders.cancel(orderId, reason.trim());
      setOrders(orders.map((o) => (o.id === orderId ? cancelled : o)));
      success(`Order ${cancelled.order_number} cancelled.`);
    } catch (err: any) {
      error(err.message || 'Could not cancel order.');
    }
  };

  const handleSyncOrderStatus = async (orderId: string) => {
    setSyncingOrderId(orderId);
    try {
      const syncRes = await api.payments.getUnifiedStatus(orderId);
      const updatedOrders = await api.orders.list();
      setOrders(updatedOrders);
      if (syncRes.payment_status === 'captured') {
        success('Payment confirmed by gateway! Order updated to verified.');
      } else if (syncRes.payment_status === 'demo_completed') {
        success('Demo payment confirmed.');
      } else {
        info(`Payment status is: ${syncRes.payment_status || 'Pending authorization'}`);
      }
    } catch (err: any) {
      error(err.message || 'Status sync failed.');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleRetryPayment = async (order: Order) => {
    try {
      setRetryingPaymentOrderId(order.id);
      const payment = getEffectivePayment(order);
      const provider = payment?.provider || 'payyantra';

      if (provider === 'payyantra') {
        const returnUrl = `${window.location.origin}/payment/payyantra/callback`;
        const res = await api.payments.createPayYantraCheckout(order.id, 'CARD', returnUrl);
        if (res.checkout_url) {
          window.location.href = res.checkout_url;
        } else {
          throw new Error('Could not obtain PayYantra checkout URL.');
        }
      } else if (provider === 'razorpay') {
        const rpOrder = await api.payments.createRazorpayOrder(order.id, 'card');
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) throw new Error('Razorpay payment gateway failed to load.');

        const options = {
          key: rpOrder.key_id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
          name: 'VARNYXA Haute Couture',
          description: `Order #${rpOrder.order_number}`,
          order_id: rpOrder.razorpay_order_id,
          prefill: {
            name: rpOrder.customer_name || user?.full_name,
            email: rpOrder.customer_email || user?.email,
            contact: rpOrder.customer_phone || user?.phone,
          },
          theme: { color: '#18181B' },
          handler: async function (response: any) {
            try {
              const vRes = await api.payments.verifyRazorpay({
                order_id: order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (vRes.verified) {
                success('Payment verified! Your order is confirmed.');
                const refreshed = await api.orders.list();
                setOrders(refreshed);
              }
            } catch (vErr: any) {
              error(vErr.message || 'Payment signature verification error.');
            }
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        const res = await api.payments.createPayYantraCheckout(order.id);
        if (res.checkout_url) {
          window.location.href = res.checkout_url;
        }
      }
    } catch (err: any) {
      error(err.message || 'Payment retry failed');
    } finally {
      setRetryingPaymentOrderId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-10">
      {/* Top Banner */}
      <div className="p-4 sm:p-8 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center font-serif text-xl sm:text-2xl font-bold shadow-md shrink-0">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-extrabold text-[var(--theme-text)]">{user.full_name}</h1>
              {subscription?.is_active && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  <Crown className="w-3 h-3" /> Privé VIP
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--theme-text-muted)] truncate max-w-[220px] sm:max-w-xs">{user.email}</p>
            <span className="inline-block mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Verified Client
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {!subscription?.is_active ? (
            <button
              onClick={() => navigate('/membership')}
              className="px-4 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center gap-1.5 transition"
            >
              <Crown className="w-3.5 h-3.5" /> Join Privé
            </button>
          ) : (
            <button
              onClick={() => navigate('/membership')}
              className="px-4 py-2 border border-[var(--theme-primary)] text-[var(--theme-primary)] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[var(--theme-primary)]/10 flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> Privé Active
            </button>
          )}

          <button
            onClick={logout}
            className="px-4 sm:px-5 py-2 sm:py-2.5 border border-[var(--theme-border)] text-red-500 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-red-500/10 transition cursor-pointer shrink-0"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Privé Membership Banner if active */}
      {subscription && subscription.is_active && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-[var(--theme-text)]">
                VARNYXA Privé: {subscription.plan_name}
              </div>
              <p className="text-xs text-[var(--theme-text-muted)]">
                Unlimited Free Express Delivery active • {subscription.days_remaining} days remaining (Expires {new Date(subscription.expiry_date).toLocaleDateString()})
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/membership')}
            className="text-xs font-bold text-[var(--theme-primary)] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            View Privé Benefits <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--theme-border)] overflow-x-auto no-scrollbar gap-2 sm:gap-6 text-xs uppercase tracking-wider font-semibold -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setSearchParams({ tab: 'orders' })}
          className={`py-3 px-2 border-b-2 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer text-xs ${
            currentTab === 'orders' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" /> My Orders ({orders.length})
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'membership' })}
          className={`py-3 px-2 border-b-2 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition cursor-pointer text-xs ${
            currentTab === 'membership' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Crown className="w-4 h-4 shrink-0 text-amber-500" /> Privé Membership
          {subscription?.is_active && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5"></span>
          )}
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'addresses' })}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            currentTab === 'addresses' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <MapPin className="w-4 h-4" /> Saved Addresses ({addresses.length})
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'wishlist' })}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            currentTab === 'wishlist' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <Heart className="w-4 h-4" /> Saved Wishlist ({wishlist?.item_count || 0})
        </button>

        <button
          onClick={() => setSearchParams({ tab: 'profile' })}
          className={`py-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            currentTab === 'profile' ? 'border-[var(--theme-primary)] text-[var(--theme-primary)]' : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
          }`}
        >
          <UserIcon className="w-4 h-4" /> Profile & Security
        </button>
      </div>

      {/* Tab 1: Orders */}
      {currentTab === 'orders' && (
        <div className="space-y-6">
          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-[var(--theme-text-muted)]">Loading your order history...</div>
          ) : orders.length > 0 ? (
            orders.map((o) => {
              const payment = getEffectivePayment(o);
              const isDemo = payment?.provider === 'demo' || payment?.status === 'demo_completed';
              const isCaptured = payment?.status === 'captured';
              const isOrderConfirmed = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(o.status);

              const isPaidOrComplete = isCaptured || isDemo || isOrderConfirmed;
              const canRetry = !isPaidOrComplete && o.status !== 'cancelled' && (payment?.status === 'pending' || payment?.status === 'failed' || !payment);
              const pBadge = getPaymentStatusBadge(payment?.status, payment?.provider);
              const fBadge = getFulfillmentStatusBadge(o.status, isDemo);
              const stage = getOrderStage(o.status, payment?.status, payment?.provider);

              return (
                <div key={o.id} className="p-4 sm:p-6 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-5">
                  {/* Order IDs & Status Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--theme-border)]">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[var(--theme-text)]">
                          VARNYXA Order ID: <span className="text-[var(--theme-primary)]">{o.order_number}</span>
                        </span>
                        {(o.payment_reference_id || payment?.reference_id) && (
                          <span className="font-mono text-xs text-[var(--theme-text-muted)] bg-[var(--theme-bg)] px-2 py-0.5 rounded border border-[var(--theme-border)]">
                            Payment Ref: {o.payment_reference_id || payment?.reference_id}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--theme-text-muted)]">
                        <span>Ordered on {formatDate(o.created_at)}</span>
                        <span>•</span>
                        <span>Latest Update: {formatDate(o.updated_at || o.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Payment Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${pBadge.className}`}>
                        <pBadge.icon className="w-3 h-3" />
                        {pBadge.label}
                      </span>

                      {/* Fulfillment Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${fBadge.className}`}>
                        <Truck className="w-3 h-3" />
                        {fBadge.label}
                      </span>

                      {/* Cancel Order Action */}
                      {(o.status === 'placed' || o.status === 'confirmed') && (
                        <button
                          onClick={() => handleCancelOrder(o.id)}
                          className="text-xs text-red-500 hover:underline font-semibold ml-2 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Order Progression Tracker */}
                  {o.status === 'cancelled' ? (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <div>
                        <strong>Order Cancelled.</strong>{' '}
                        {o.cancellation_reason ? `Reason: ${o.cancellation_reason}` : 'This order was cancelled before fulfillment.'}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">
                        <span className="flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-[var(--theme-primary)]" />
                          Order & Delivery Journey
                        </span>
                        <span className="text-[11px] font-mono text-[var(--theme-text-muted)]">
                          Stage {Math.max(1, stage)} of 6
                        </span>
                      </div>

                      {/* Step Progress Tracker Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-1 pt-1">
                        {[
                          { num: 1, label: 'Order Placed', desc: 'Received' },
                          { num: 2, label: isDemo ? 'Demo Verified' : 'Payment Verified', desc: isPaidOrComplete ? (isDemo ? 'Demo OK' : 'Captured') : 'Pending' },
                          { num: 3, label: 'Processing', desc: 'In Atelier' },
                          { num: 4, label: 'Shipped', desc: 'Dispatched' },
                          { num: 5, label: 'Out for Delivery', desc: 'On Route' },
                          { num: 6, label: 'Delivered', desc: 'Handed to Client' },
                        ].map((s) => {
                          const isDone = stage > s.num;
                          const isCurrent = stage === s.num;
                          const isUpcoming = stage < s.num;

                          return (
                            <div
                              key={s.num}
                              className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-between min-h-[64px] ${
                                isCurrent
                                  ? 'bg-[var(--theme-primary)]/10 border-[var(--theme-primary)] text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/30'
                                  : isDone
                                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-[var(--theme-surface)] border-[var(--theme-border)]/60 text-[var(--theme-text-muted)] opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mb-1">
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : isCurrent ? (
                                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--theme-primary)] animate-pulse" />
                                ) : (
                                  <span className="text-[10px] text-[var(--theme-text-muted)]">{s.num}</span>
                                )}
                              </div>
                              <span className="text-[11px] font-bold leading-tight line-clamp-1">{s.label}</span>
                              <span className="text-[9px] uppercase tracking-wider text-[var(--theme-text-muted)] mt-0.5">{s.desc}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Logistics & Courier Live Detail Card */}
                      <div className="mt-3 pt-3 border-t border-[var(--theme-border)] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Courier Partner</span>
                          <span className="font-semibold text-[var(--theme-text)]">
                            {o.courier_partner || 'Atelier Logistics (Pending Dispatch)'}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Tracking / AWB Number</span>
                          <span className="font-mono font-semibold text-[var(--theme-text)]">
                            {o.tracking_number || 'Will be assigned on dispatch'}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Fulfillment State</span>
                          <span className="font-semibold text-[var(--theme-text)]">
                            {o.delivered_at
                              ? `Delivered on ${formatDate(o.delivered_at)}`
                              : o.status === 'shipped' || o.status === 'out_for_delivery'
                              ? 'Package in transit with logistics courier'
                              : 'Preparing tailored garments at atelier'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items in this order */}
                  <div className="divide-y divide-[var(--theme-border)]/50">
                    {o.items.map((item) => (
                      <div key={item.id} className="py-3 flex items-center gap-4 text-xs">
                        <div className="w-14 h-18 bg-[var(--theme-bg)] rounded-xl overflow-hidden shrink-0 border border-[var(--theme-border)]">
                          {item.image_url && <img src={item.image_url} alt={item.product_title} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-[var(--theme-text)]">{item.product_title}</h4>
                          <p className="text-[var(--theme-text-muted)] mt-0.5">
                            Size: {item.size} • Color: {item.color_name} • Qty: {item.quantity}
                          </p>
                        </div>
                        <span className="font-bold text-[var(--theme-text)]">{formatPrice(item.total_price)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Comprehensive Financial Breakdown */}
                  <div className="pt-3 border-t border-[var(--theme-border)] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Shipping Address Summary */}
                    <div className="text-[var(--theme-text-muted)] space-y-0.5">
                      <span className="font-semibold text-[var(--theme-text)] block mb-1">Delivery Destination:</span>
                      <p>{o.shipping_address?.full_name} • {o.shipping_address?.phone}</p>
                      <p>{o.shipping_address?.address_line1}, {o.shipping_address?.city}, {o.shipping_address?.state} - {o.shipping_address?.postal_code}</p>
                      {payment && (
                        <div className="pt-2 text-[11px] space-y-0.5">
                          <p>
                            Payment Method / Rail:{' '}
                            <span className="font-semibold text-[var(--theme-text)]">
                              {payment.provider === 'payyantra'
                                ? 'PayYantra Hosted V3'
                                : payment.provider === 'demo'
                                ? 'Seamless UPI Rails (Interactive Demo)'
                                : payment.provider === 'razorpay'
                                ? 'Razorpay Standard'
                                : payment.provider.toUpperCase()}
                            </span>
                          </p>
                          {payment.provider === 'demo' && (
                            <p className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                              Demo Transaction Ref: {payment.reference_id || payment.transaction_id || payment.razorpay_payment_id || 'UPI-DEMO-VERIFIED'}
                            </p>
                          )}
                          {payment.payyantra_order_id && (
                            <p className="font-mono text-[10px]">
                              PayYantra Order: {payment.payyantra_order_id}
                            </p>
                          )}
                          {payment.rrn && (
                            <p className="font-mono text-[10px]">
                              Bank Ref / RRN: {payment.rrn}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-1 bg-[var(--theme-bg)] p-3 rounded-xl border border-[var(--theme-border)]">
                      <div className="flex justify-between text-[var(--theme-text-muted)]">
                        <span>Merchandise Subtotal</span>
                        <span>{formatPrice(o.subtotal)}</span>
                      </div>
                      {o.discount_amount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>Discount Applied ({o.coupon_code || 'PROMO'})</span>
                          <span>-{formatPrice(o.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[var(--theme-text-muted)]">
                        <span>Delivery Fee</span>
                        <span className={o.shipping_fee === 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                          {o.shipping_fee === 0 ? 'FREE' : formatPrice(o.shipping_fee)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--theme-text-muted)]">
                        <span>GST ({o.tax_rate ?? 18}%)</span>
                        <span>{formatPrice(o.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-[var(--theme-text)] pt-1 border-t border-[var(--theme-border)]">
                        <span>Order Total</span>
                        <span className="text-[var(--theme-primary)]">{formatPrice(o.total_amount)}</span>
                      </div>

                      {/* Action buttons depending on payment state */}
                      {canRetry && (
                        <div className="pt-2 space-y-1.5">
                          <button
                            onClick={() => handleRetryPayment(o)}
                            disabled={retryingPaymentOrderId === o.id}
                            className="w-full py-2 px-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] font-bold text-xs uppercase tracking-wider rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            {retryingPaymentOrderId === o.id ? 'Connecting to Gateway...' : 'Complete Payment Now'}
                          </button>
                          <button
                            onClick={() => handleSyncOrderStatus(o.id)}
                            disabled={syncingOrderId === o.id}
                            className="w-full py-1.5 px-3 bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] font-medium text-[11px] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--theme-bg)] flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingOrderId === o.id ? 'animate-spin' : ''}`} />
                            {syncingOrderId === o.id ? 'Verifying with Gateway...' : 'Sync Payment Status'}
                          </button>
                        </div>
                      )}

                      {isPaidOrComplete && (
                        <div className="pt-2">
                          <button
                            onClick={() => navigate(`/order-confirmation/${o.id}`)}
                            className="w-full py-2 px-3 bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] font-semibold text-xs rounded-lg hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {isDemo ? 'View Order & Demo Receipt' : 'View Order & Tax Invoice'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-16 text-center bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] space-y-3">
              <Package className="w-12 h-12 text-[var(--theme-text-muted)] mx-auto" />
              <h3 className="font-serif text-lg font-bold text-[var(--theme-text)]">No Orders Recorded Yet</h3>
              <p className="text-xs text-[var(--theme-text-muted)]">Your bespoke orders and deliveries will appear here.</p>
              <button
                onClick={() => navigate('/shop')}
                className="px-6 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase rounded-xl cursor-pointer"
              >
                Start Shopping
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Privé Membership */}
      {currentTab === 'membership' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--theme-border)]">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
                  <Crown className="w-4 h-4 text-amber-500" /> VARNYXA Privé Client Status
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[var(--theme-text)] mt-1">
                  Membership & VIP Privileges
                </h3>
                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                  Verified premium membership unlocks unlimited complimentary express delivery and concierge tailoring.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/membership')}
                  className="px-4 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {subscription?.is_active ? 'Upgrade or Renew' : 'View Privé Tiers'}
                </button>
              </div>
            </div>

            {/* Membership Overview Card */}
            {subscription ? (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--theme-border)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg font-bold text-[var(--theme-text)]">
                          {subscription.plan_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            subscription.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : subscription.payment_status === 'pending'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          }`}
                        >
                          {subscription.is_active
                            ? 'Active Member'
                            : subscription.payment_status === 'pending'
                            ? 'Pending Gateway Verification'
                            : 'Inactive / Expired'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                        Tier Code: {subscription.plan_code || 'PRIVE'}
                      </p>
                    </div>

                    <div className="text-right sm:text-right">
                      <span className="text-xs text-[var(--theme-text-muted)] uppercase block">Membership Tenure</span>
                      <span className="font-mono text-sm font-bold text-[var(--theme-text)]">
                        {subscription.days_remaining} Days Remaining
                      </span>
                    </div>
                  </div>

                  {/* Pending Payment Alert & Manual Verify */}
                  {subscription.payment_status === 'pending' && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                        <span>
                          Payment verification is currently pending. If you completed payment, click to verify status with PayYantra.
                        </span>
                      </div>
                      <button
                        onClick={() => handleVerifySubscription(subscription.id)}
                        disabled={isVerifyingSub}
                        className="px-3.5 py-1.5 bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-amber-600 transition shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isVerifyingSub ? 'Verifying with Gateway...' : 'Verify Status'}
                      </button>
                    </div>
                  )}

                  {/* Subscription Credential Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Start Date</span>
                      <span className="font-mono text-[var(--theme-text)]">
                        {subscription.start_date ? formatDate(subscription.start_date) : 'Pending activation'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Expiry Date</span>
                      <span className="font-mono text-[var(--theme-text)]">
                        {subscription.expiry_date ? formatDate(subscription.expiry_date) : 'Pending activation'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Payment Reference ID</span>
                      <span className="font-mono text-[var(--theme-text)]">
                        {subscription.payment_reference || 'N/A'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Amount Incurred</span>
                      <span className="font-bold text-[var(--theme-primary)]">
                        {formatPrice(subscription.amount_paid || subscription.price_paid || 0)}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Payment Status</span>
                      <span className="font-semibold capitalize text-[var(--theme-text)]">
                        {subscription.payment_status || 'Pending'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] block">Checkout Gateway</span>
                      <span className="font-semibold text-[var(--theme-text)]">
                        PayYantra Hosted V3
                      </span>
                    </div>
                  </div>
                </div>

                {/* Privileges Grid */}
                <div>
                  <h4 className="font-serif text-sm font-bold uppercase tracking-wider text-[var(--theme-text)] mb-3">
                    Active Membership Perks
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(subscription.benefits && subscription.benefits.length > 0 ? subscription.benefits : [
                      'Unlimited Free Express Delivery across India (₹0 fee on every order)',
                      'Priority Atelier Tailoring & Fast-Track Dispatch',
                      'Dedicated Personal Stylist Consultations & Size Fitting',
                      'Exclusive Early Access to Haute Drops & Seasonal Sales',
                    ]).map((b, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs flex items-center gap-3"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span className="text-[var(--theme-text)] font-medium">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] space-y-4">
                <Crown className="w-12 h-12 text-amber-500/80 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-serif text-lg font-bold text-[var(--theme-text)]">
                    Elevate to VARNYXA Privé
                  </h4>
                  <p className="text-xs text-[var(--theme-text-muted)] max-w-md mx-auto">
                    Enjoy unlimited free express shipping on every order, priority atelier crafting, and bespoke stylist recommendations.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/membership')}
                  className="px-6 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition cursor-pointer"
                >
                  Explore Privé Memberships
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Addresses */}
      {currentTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-lg font-bold text-[var(--theme-text)]">Saved Delivery Destinations</h3>
            {!isAddingAddress && (
              <button
                onClick={() => setIsAddingAddress(true)}
                className="px-4 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase rounded-xl flex items-center gap-1.5 hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" /> Add Destination
              </button>
            )}
          </div>

          {isAddingAddress && (
            <form onSubmit={handleAddAddress} className="p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] space-y-4">
              <h4 className="text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider">New Shipping Address</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  required
                  type="text"
                  placeholder="Receiver's Full Name"
                  value={newAddr.full_name}
                  onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })}
                  className="px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
                />
                <input
                  required
                  type="tel"
                  placeholder="Phone Number"
                  value={newAddr.phone}
                  onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                  className="px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
                />
              </div>
              <input
                required
                type="text"
                placeholder="House / Flat / Street address"
                value={newAddr.address_line1}
                onChange={(e) => setNewAddr({ ...newAddr, address_line1: e.target.value })}
                className="w-full px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  required
                  type="text"
                  placeholder="City"
                  value={newAddr.city}
                  onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                  className="px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
                />
                <input
                  required
                  type="text"
                  placeholder="State"
                  value={newAddr.state}
                  onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                  className="px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
                />
                <input
                  required
                  type="text"
                  placeholder="Pincode"
                  value={newAddr.postal_code}
                  onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })}
                  className="px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl font-mono focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-5 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold rounded-xl hover:opacity-90 transition">
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingAddress(false)}
                  className="px-5 py-2 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-bg)] transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {addresses.map((a) => (
              <div key={a.id} className="p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--theme-text)]">{a.full_name}</h4>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                      {a.address_type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteAddress(a.id)}
                    className="p-1.5 text-[var(--theme-text-muted)] hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-[var(--theme-text-muted)]">{a.address_line1}</p>
                <p className="text-xs text-[var(--theme-text-muted)]">{a.city}, {a.state} - {a.postal_code}</p>
                <p className="text-xs text-[var(--theme-text-muted)] font-mono">Mobile: {a.phone}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Wishlist */}
      {currentTab === 'wishlist' && (
        <div className="space-y-6">
          <h3 className="font-serif text-lg font-bold text-[var(--theme-text)]">Saved Wishlist Garments</h3>
          {wishlist && wishlist.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {wishlist.items.map((item) => (
                <div key={item.id} className="bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] overflow-hidden p-3 space-y-3 shadow-sm">
                  <div className="aspect-[3/4] bg-[var(--theme-bg)] rounded-xl overflow-hidden">
                    {item.primary_image_url && <img src={item.primary_image_url} alt={item.product_title} className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-[var(--theme-text)] truncate">{item.product_title}</h4>
                    <span className="font-bold text-xs text-[var(--theme-text)] block mt-1">{formatPrice(item.sale_price || item.base_price)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/product/${item.product_slug}`)}
                      className="flex-1 py-1.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-[11px] font-bold rounded-lg uppercase hover:opacity-90 transition"
                    >
                      View
                    </button>
                    <button
                      onClick={() => toggleWishlist(item.product_id)}
                      className="p-1.5 text-red-500 border border-red-300 dark:border-red-900/50 rounded-lg hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] space-y-3">
              <Heart className="w-12 h-12 text-[var(--theme-text-muted)] mx-auto" />
              <h3 className="font-serif text-lg font-bold text-[var(--theme-text)]">Your Wishlist is Empty</h3>
              <p className="text-xs text-[var(--theme-text-muted)]">Save garments as you browse to revisit them anytime.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Profile & Password */}
      {currentTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Edit Profile */}
          <form onSubmit={handleUpdateProfile} className="p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-[var(--theme-text)] uppercase tracking-wider">
              Profile Details
            </h3>
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">Phone Number</label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-6 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase rounded-xl hover:opacity-90 transition"
            >
              {isUpdatingProfile ? 'Updating...' : 'Save Profile'}
            </button>
          </form>

          {/* Change Password */}
          <form onSubmit={handleChangePassword} className="p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-[var(--theme-text)] uppercase tracking-wider">
              Security & Password
            </h3>
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">Current Password</label>
              <input
                required
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--theme-text)] mb-1">New Password (Min 8 chars)</label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-6 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase rounded-xl hover:opacity-90 transition"
            >
              {isChangingPassword ? 'Changing...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
