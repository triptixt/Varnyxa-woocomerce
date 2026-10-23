import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Package,
  Crown,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { PayYantraStatusResponse, SubscriptionStatusResponse } from '../types';
import { formatPrice } from '../utils/formatters';

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshCart } = useCart();
  const { success, error: toastError } = useToast();

  const orderId = searchParams.get('order_id');
  const subscriptionId = searchParams.get('subscription_id');
  const isSubscriptionFlow = Boolean(subscriptionId || searchParams.get('type') === 'subscription');

  // State for order payment
  const [orderStatusData, setOrderStatusData] = useState<PayYantraStatusResponse | null>(null);
  // State for subscription payment
  const [subStatusData, setSubStatusData] = useState<SubscriptionStatusResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [pollCount, setPollCount] = useState<number>(0);
  const maxPolls = 3;
  const pollTimerRef = useRef<any>(null);

  const fetchStatus = async (isManual = false) => {
    if (!orderId && !subscriptionId) {
      setLoading(false);
      return;
    }

    if (isManual) setLoading(true);

    try {
      if (isSubscriptionFlow && subscriptionId) {
        // -------------------------------------------------------------
        // Verify Subscription Payment Status
        // -------------------------------------------------------------
        const subData = await api.subscriptions.getStatus(subscriptionId);
        setSubStatusData(subData);

        if (subData.is_active || subData.payment_status === 'captured') {
          success(`Welcome to VARNYXA Privé! ${subData.plan_name} is now verified and active.`);
        } else if (subData.payment_status === 'pending' && pollCount < maxPolls && !isManual) {
          pollTimerRef.current = setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 3500);
        }
      } else if (orderId) {
        // -------------------------------------------------------------
        // Verify Client Order Payment Status
        // -------------------------------------------------------------
        const data = await api.payments.getPayYantraStatus(orderId);
        setOrderStatusData(data);

        if (data.payment_status === 'captured') {
          await refreshCart();
          success('Payment confirmed successfully. Your wardrobe order is placed!');
        } else if (data.payment_status === 'pending' && pollCount < maxPolls && !isManual) {
          pollTimerRef.current = setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 3500);
        }
      }
    } catch (err: any) {
      console.error('Error checking PayYantra payment status:', err);
      toastError(err.message || 'Could not verify payment status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [orderId, subscriptionId, pollCount]);

  const handleRetryOrderPayment = async () => {
    if (!orderId) return;
    setIsRetrying(true);
    try {
      const res = await api.payments.createPayYantraCheckout(orderId);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        throw new Error('Could not obtain PayYantra checkout URL.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to restart payment. Please try again.');
      setIsRetrying(false);
    }
  };

  // -----------------------------------------------------------------
  // Missing Reference View
  // -----------------------------------------------------------------
  if (!orderId && !subscriptionId) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 bg-[var(--theme-bg)] text-[var(--theme-text)]">
        <div className="max-w-md w-full bg-[var(--theme-surface)] p-8 rounded-3xl border border-[var(--theme-border)] text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-[var(--theme-text-muted)] mx-auto" />
          <h2 className="font-serif text-xl font-bold">Missing Transaction Reference</h2>
          <p className="text-xs text-[var(--theme-text-muted)]">
            No order or subscription reference was provided in the payment callback URL.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition"
          >
            <span>Return to Store</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // Loading View
  // -----------------------------------------------------------------
  if (loading && !orderStatusData && !subStatusData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 space-y-4 bg-[var(--theme-bg)] text-[var(--theme-text)]">
        <div className="w-12 h-12 rounded-full border-2 border-[var(--theme-primary)] border-t-transparent animate-spin" />
        <h2 className="font-serif text-xl font-bold tracking-wide">
          Verifying Payment with PayYantra...
        </h2>
        <p className="text-xs text-[var(--theme-text-muted)] tracking-wide">
          Please wait while we securely confirm your transaction with the payment gateway.
        </p>
      </div>
    );
  }

  // Determine State
  const isSubSuccess = subStatusData?.is_active || subStatusData?.payment_status === 'captured';
  const isSubPending = subStatusData?.payment_status === 'pending';
  const isSubFailed = subStatusData?.payment_status === 'failed' || subStatusData?.subscription_status === 'cancelled';

  const isOrderSuccess = orderStatusData?.payment_status === 'captured';
  const isOrderPending = orderStatusData?.payment_status === 'pending';
  const isOrderFailed = orderStatusData?.payment_status === 'failed';

  return (
    <div className="min-h-[75vh] py-8 sm:py-16 px-3 sm:px-4 max-w-3xl mx-auto bg-[var(--theme-bg)] text-[var(--theme-text)]">
      {/* ================================================================= */}
      {/* A. SUBSCRIPTION PAYMENT CALLBACK VIEWS */}
      {/* ================================================================= */}
      {isSubscriptionFlow && (
        <>
          {/* 1. Subscription Success */}
          {isSubSuccess && (
            <div className="bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] p-5 sm:p-8 md:p-12 shadow-sm text-center space-y-6 sm:space-y-8">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Crown className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Privé VIP Membership Active
                </span>
                <h1 className="font-serif text-3xl font-bold mt-3">
                  Welcome to VARNYXA Privé
                </h1>
                <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
                  Your payment has been verified with PayYantra. Your VIP privileges and unlimited complimentary express delivery are now active.
                </p>
              </div>

              <div className="p-6 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] text-left space-y-3 max-w-lg mx-auto text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-muted)]">Membership Plan:</span>
                  <span className="font-bold">{subStatusData?.plan_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-muted)]">Amount Paid:</span>
                  <span className="font-bold">{formatPrice(subStatusData?.amount || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-muted)]">Payment Reference:</span>
                  <span className="font-mono font-bold text-[var(--theme-primary)]">{subStatusData?.payment_reference}</span>
                </div>
                {subStatusData?.payyantra_order_id && (
                  <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                    <span className="text-[var(--theme-text-muted)]">PayYantra Order ID:</span>
                    <span className="font-mono">{subStatusData.payyantra_order_id}</span>
                  </div>
                )}
                {subStatusData?.expiry_date && (
                  <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                    <span className="text-[var(--theme-text-muted)]">Valid Until:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {new Date(subStatusData.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} ({subStatusData.days_remaining} days left)
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-[var(--theme-text-muted)]">Active VIP Perk:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Complimentary Delivery Unlocked
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Link
                  to="/account"
                  className="w-full sm:w-auto px-8 py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition text-center"
                >
                  View My Account
                </Link>
                <Link
                  to="/shop"
                  className="w-full sm:w-auto px-8 py-3.5 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[var(--theme-surface)] transition text-center"
                >
                  Start Shopping with VIP Delivery
                </Link>
              </div>
            </div>
          )}

          {/* 2. Subscription Pending */}
          {isSubPending && (
            <div className="bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] p-5 sm:p-8 md:p-12 shadow-sm text-center space-y-6">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Clock className="w-10 h-10 animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Subscription Awaiting Confirmation
                </span>
                <h1 className="font-serif text-2xl font-bold mt-3">
                  Confirming Your Privé Membership
                </h1>
                <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
                  PayYantra is currently awaiting authorization from your bank/UPI app. Your subscription will activate automatically once confirmation is received.
                </p>
              </div>

              <div className="p-4 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] text-left space-y-2 max-w-md mx-auto text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Payment Reference:</span>
                  <span className="font-mono font-bold">{subStatusData?.payment_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Plan:</span>
                  <span className="font-bold">{subStatusData?.plan_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Amount:</span>
                  <span className="font-bold">{formatPrice(subStatusData?.amount || 0)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => fetchStatus(true)}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Checking...' : 'Check Status Now'}</span>
                </button>
                <Link
                  to="/membership"
                  className="w-full sm:w-auto px-6 py-3 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface)] text-center"
                >
                  Back to Membership Page
                </Link>
              </div>
            </div>
          )}

          {/* 3. Subscription Failed */}
          {isSubFailed && (
            <div className="bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] p-5 sm:p-8 md:p-12 shadow-sm text-center space-y-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <AlertCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  Payment Unsuccessful
                </span>
                <h1 className="font-serif text-2xl font-bold mt-3">
                  Subscription Payment Incomplete
                </h1>
                <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
                  {subStatusData?.error_description ||
                    'The payment session was cancelled or declined by your bank/UPI app. No membership fees were charged and premium benefits were not activated.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  to="/membership"
                  className="w-full sm:w-auto px-8 py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition text-center"
                >
                  Retry Privé Membership
                </Link>
                <Link
                  to="/shop"
                  className="w-full sm:w-auto px-8 py-3.5 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface)] text-center"
                >
                  Continue Browsing Catalog
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* B. ORDER PAYMENT CALLBACK VIEWS */}
      {/* ================================================================= */}
      {!isSubscriptionFlow && (
        <>
          {/* 1. Order Success */}
          {isOrderSuccess && (
            <div className="bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] p-5 sm:p-8 md:p-12 shadow-sm text-center space-y-6 sm:space-y-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Payment Confirmed
                </span>
                <h1 className="font-serif text-3xl font-bold mt-3">
                  Thank You For Your Order
                </h1>
                <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
                  Your transaction has been verified via PayYantra Hosted Checkout. Our master artisans are now preparing your order.
                </p>
              </div>

              <div className="p-6 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] text-left space-y-3 max-w-lg mx-auto text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-muted)]">VARNYXA Order Number:</span>
                  <span className="font-mono font-bold">{orderStatusData?.order_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                  <span className="text-[var(--theme-text-muted)]">Amount Paid:</span>
                  <span className="font-bold">{formatPrice(orderStatusData?.amount || 0)}</span>
                </div>
                {orderStatusData?.reference_id && (
                  <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                    <span className="text-[var(--theme-text-muted)]">Payment Reference ID:</span>
                    <span className="font-mono font-bold text-[var(--theme-primary)]">{orderStatusData.reference_id}</span>
                  </div>
                )}
                {orderStatusData?.rrn && (
                  <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                    <span className="text-[var(--theme-text-muted)]">Bank Reference (RRN):</span>
                    <span className="font-mono">{orderStatusData.rrn}</span>
                  </div>
                )}
                {orderStatusData?.payyantra_order_id && (
                  <div className="flex justify-between py-1 border-b border-[var(--theme-border)]">
                    <span className="text-[var(--theme-text-muted)]">PayYantra ID:</span>
                    <span className="font-mono truncate max-w-[200px]">
                      {orderStatusData.payyantra_order_id}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-[var(--theme-text-muted)]">Payment Gateway:</span>
                  <span className="font-semibold">PayYantra Hosted Checkout V3</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Link
                  to={`/order-confirmation/${orderId}`}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition text-center"
                >
                  View Order Details
                </Link>
                <Link
                  to="/account?tab=orders"
                  className="w-full sm:w-auto px-8 py-3.5 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[var(--theme-surface)] transition text-center"
                >
                  My Wardrobe Orders
                </Link>
              </div>
            </div>
          )}

          {/* 2. Order Pending */}
          {isOrderPending && (
            <div className="bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] p-5 sm:p-8 md:p-12 shadow-sm text-center space-y-6">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Clock className="w-10 h-10 animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Payment In Progress
                </span>
                <h1 className="font-serif text-2xl font-bold mt-3">
                  Payment Awaiting Bank Confirmation
                </h1>
                <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
                  PayYantra is currently waiting for authorization from your bank or UPI provider. This may take up to a minute.
                </p>
              </div>

              <div className="p-4 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] text-left space-y-2 max-w-md mx-auto text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Order Reference:</span>
                  <span className="font-mono font-bold">{orderStatusData?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Payable Amount:</span>
                  <span className="font-bold">{formatPrice(orderStatusData?.amount || 0)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => fetchStatus(true)}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Checking...' : 'Check Status Now'}</span>
                </button>
                <Link
                  to="/account?tab=orders"
                  className="w-full sm:w-auto px-6 py-3 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface)] text-center"
                >
                  Check Later in My Orders
                </Link>
              </div>
            </div>
          )}

          {/* 3. Order Failed */}
          {isOrderFailed && (
            <div className="bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] p-5 sm:p-8 md:p-12 shadow-sm text-center space-y-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <AlertCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  Payment Not Completed
                </span>
                <h1 className="font-serif text-2xl font-bold mt-3">
                  Payment Was Unsuccessful
                </h1>
                <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
                  {orderStatusData?.error_description ||
                    'The payment session was cancelled or declined by your bank/UPI app. No money was deducted from your account.'}
                </p>
              </div>

              <div className="p-4 bg-[var(--theme-bg)] rounded-2xl border border-[var(--theme-border)] text-left space-y-2 max-w-md mx-auto text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Order Number:</span>
                  <span className="font-mono font-bold">{orderStatusData?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Amount:</span>
                  <span className="font-bold">{formatPrice(orderStatusData?.amount || 0)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleRetryOrderPayment}
                  disabled={isRetrying}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>{isRetrying ? 'Launching Checkout...' : 'Retry Payment on PayYantra'}</span>
                </button>
                <Link
                  to="/cart"
                  className="w-full sm:w-auto px-8 py-3.5 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface)] text-center"
                >
                  Back to Shopping Bag
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Security notice footer */}
      <div className="mt-8 text-center flex items-center justify-center gap-2 text-xs text-[var(--theme-text-muted)]">
        <ShieldCheck className="w-4 h-4 text-[var(--theme-primary)]" />
        <span>Transactions protected by PayYantra 256-bit encryption & RBI guidelines.</span>
      </div>
    </div>
  );
};
