import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  Truck,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Download,
  RotateCw,
  Home,
  FileText,
} from 'lucide-react';
import { Order } from '../types';
import { api } from '../services/api';
import { formatPrice, formatDate } from '../utils/formatters';
import { useToast } from '../context/ToastContext';
import { ReceiptModal, ReceiptData } from '../components/payment/ReceiptModal';

export const OrderConfirmationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError, info } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const fetchOrder = async () => {
    if (!id || id === 'demo') return;
    try {
      setLoading(true);
      const data = await api.orders.getById(id);
      setOrder(data);
    } catch (err: any) {
      toastError(err.message || 'Could not load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id === 'demo') {
      const stored = sessionStorage.getItem('varnyxa_demo_order');
      let demoData: any = null;
      if (stored) {
        try {
          demoData = JSON.parse(stored);
        } catch {
          // ignore
        }
      }

      if (!demoData) {
        demoData = {
          isDemo: true,
          orderNumber: `VNX-DEMO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-7482`,
          paymentReference: `PAYREF-DEMO-${Math.floor(100000 + Math.random() * 900000)}`,
          paymentMethod: 'UPI QR (Seamless Demo)',
          paymentGateway: 'Instant UPI Rails',
          paidAt: new Date().toISOString(),
          customerName: 'Valued Client (Demo)',
          customerEmail: 'client@varnyxa.com',
          shippingAddress: {
            full_name: 'Valued Client (Demo)',
            address_line1: '100 Haute Couture Boulevard',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400001',
            phone: '9876543210',
          },
          items: [
            {
              id: 'demo-1',
              product_title: 'Atelier Signature Silk Ensemble',
              size: 'M',
              color_name: 'Noir Classic',
              quantity: 1,
              unit_price: 2999.0,
              total_price: 2999.0,
            },
          ],
          subtotal: 2541.53,
          discountAmount: 0,
          couponCode: null,
          shippingFee: 0,
          taxAmount: 457.47,
          taxRate: 18,
          totalAmount: 2999.0,
          currency: 'INR',
        };
      }

      const mockDemoOrder: any = {
        id: 'demo',
        order_number: demoData.orderNumber,
        payment_reference_id: demoData.paymentReference,
        status: 'confirmed',
        subtotal: demoData.subtotal,
        discount_amount: demoData.discountAmount || 0,
        coupon_code: demoData.couponCode,
        shipping_fee: demoData.shippingFee || 0,
        tax_amount: demoData.taxAmount,
        tax_rate: demoData.taxRate || 18,
        total_amount: demoData.totalAmount,
        currency: demoData.currency || 'INR',
        shipping_address: demoData.shippingAddress,
        created_at: demoData.paidAt || new Date().toISOString(),
        items: demoData.items.map((it: any, idx: number) => ({
          id: it.id || `demo-item-${idx}`,
          product_title: it.product_title,
          size: it.size || 'Standard',
          color_name: it.color_name || 'Signature',
          quantity: it.quantity || 1,
          unit_price: it.unit_price,
          total_price: it.total_price,
          image_url: it.image_url,
        })),
        payments: [
          {
            id: 'demo-payment-1',
            provider: 'seamless_upi',
            payment_method: 'UPI QR (Seamless Demo)',
            status: 'captured',
            amount: demoData.totalAmount,
            currency: 'INR',
            created_at: demoData.paidAt || new Date().toISOString(),
            verified_at: demoData.paidAt || new Date().toISOString(),
            rrn: 'RRN-DEMO-998822',
          },
        ],
      };

      setOrder(mockDemoOrder);
      setLoading(false);
      return;
    }

    fetchOrder();
  }, [id]);

  const handleVerifyPaymentStatus = async () => {
    if (!order) return;
    setIsVerifying(true);
    try {
      const provider = order.payments?.[0]?.provider || 'payyantra';
      if (provider === 'payyantra') {
        const res = await api.payments.getPayYantraStatus(order.id);
        if (res.payment_status === 'captured') {
          success('Payment confirmed successfully by PayYantra!');
          await fetchOrder();
        } else if (res.payment_status === 'pending') {
          info('Payment is still awaiting authorization from your bank/UPI app.');
        } else {
          toastError(res.error_description || 'Payment was declined or cancelled.');
          await fetchOrder();
        }
      } else {
        const res = await api.payments.getRazorpayStatus(order.id);
        if (res.payment_status === 'captured') {
          success('Payment verified successfully!');
          await fetchOrder();
        } else {
          info('Payment status is still pending with Razorpay.');
        }
      }
    } catch (err: any) {
      toastError(err.message || 'Could not verify payment status.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenReceipt = async () => {
    if (!order) return;

    // For demo transactions: generate receipt strictly in memory without contacting backend
    const isDemoOrder =
      id === 'demo' ||
      order.id === 'demo' ||
      order.payments?.some((p) => p.provider === 'demo' || p.status === 'demo_completed') ||
      order.order_number?.startsWith('VNX-DEMO');

    if (isDemoOrder) {
      const stored = sessionStorage.getItem('varnyxa_demo_order');
      let demoData: any = null;
      if (stored) {
        try {
          demoData = JSON.parse(stored);
        } catch {
          // ignore
        }
      }

      const primaryPayment = order.payments?.[0];
      const addr = order.shipping_address || {};

      setReceiptData({
        isDemo: true,
        orderNumber: demoData?.orderNumber || order.order_number,
        orderId: 'DEMO-TRANSACTION-12345',
        paymentReference: demoData?.paymentReference || order.payment_reference_id || 'PAYREF-DEMO-12345',
        paymentMethod: 'UPI QR (Seamless Demo)',
        paymentGateway: 'VARNYXA Seamless UPI Rails',
        transactionId: 'TXN-DEMO-12345',
        bankRrn: 'RRN-DEMO-998822',
        paidAt: demoData?.paidAt || order.created_at || new Date().toISOString(),
        customerName: demoData?.customerName || addr.full_name || 'Valued Client (Demo)',
        customerEmail: demoData?.customerEmail || 'client@varnyxa.com',
        customerPhone: demoData?.customerPhone || addr.phone || '9876543210',
        shippingAddress: addr,
        items: order.items.map((it) => ({
          product_title: it.product_title,
          size: it.size,
          color_name: it.color_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
        })),
        subtotal: order.subtotal,
        discountAmount: order.discount_amount,
        couponCode: order.coupon_code,
        shippingFee: order.shipping_fee,
        taxAmount: order.tax_amount,
        taxRate: order.tax_rate,
        totalAmount: order.total_amount,
        currency: order.currency || 'INR',
      });
      setShowReceiptModal(true);
      return;
    }

    try {
      // Attempt to load official receipt payload from backend
      const receiptRes = await api.orders.getReceipt(order.id);
      setReceiptData({
        isDemo: false,
        orderNumber: receiptRes.order_number,
        orderId: receiptRes.order_id,
        paymentReference: receiptRes.payment_reference_id,
        paymentMethod: receiptRes.payment_method,
        paymentGateway: receiptRes.payment_gateway,
        transactionId: receiptRes.transaction_id,
        bankRrn: receiptRes.bank_rrn,
        paidAt: receiptRes.payment_date,
        customerName: receiptRes.customer_name,
        customerEmail: receiptRes.customer_email,
        customerPhone: receiptRes.customer_phone,
        shippingAddress: receiptRes.shipping_address,
        items: receiptRes.items,
        subtotal: receiptRes.subtotal,
        discountAmount: receiptRes.discount_amount,
        couponCode: receiptRes.coupon_code,
        shippingFee: receiptRes.shipping_fee,
        taxAmount: receiptRes.tax_amount,
        taxRate: receiptRes.tax_rate,
        totalAmount: receiptRes.total_amount,
        currency: receiptRes.currency,
      });
      setShowReceiptModal(true);
    } catch (err: any) {
      // Fallback: build receipt from loaded verified order
      const capturedPayment = order.payments?.find((p) => p.status === 'captured') || order.payments?.[0];
      const addr = order.shipping_address || {};
      setReceiptData({
        isDemo: false,
        orderNumber: order.order_number,
        orderId: order.id,
        paymentReference: order.payment_reference_id || capturedPayment?.reference_id || `REF-${order.order_number}`,
        paymentMethod: capturedPayment?.payment_method?.toUpperCase() || 'Direct Checkout',
        paymentGateway: capturedPayment?.provider === 'payyantra' ? 'PayYantra Hosted Checkout' : 'Razorpay Secure',
        transactionId: capturedPayment?.razorpay_payment_id || capturedPayment?.payyantra_order_id,
        bankRrn: capturedPayment?.rrn,
        paidAt: capturedPayment?.verified_at || order.created_at,
        customerName: addr.full_name || 'Valued Customer',
        customerEmail: 'customer@varnyxa.com',
        customerPhone: addr.phone,
        shippingAddress: addr,
        items: order.items.map((it) => ({
          product_title: it.product_title,
          size: it.size,
          color_name: it.color_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
        })),
        subtotal: order.subtotal,
        discountAmount: order.discount_amount,
        couponCode: order.coupon_code,
        shippingFee: order.shipping_fee,
        taxAmount: order.tax_amount,
        taxRate: order.tax_rate,
        totalAmount: order.total_amount,
        currency: order.currency,
      });
      setShowReceiptModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 bg-[var(--theme-bg)] text-[var(--theme-text)]">
        <div className="w-12 h-12 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[var(--theme-text-muted)] mt-4 uppercase tracking-wider font-semibold">
          Verifying Order Record...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 bg-[var(--theme-bg)] text-[var(--theme-text)]">
        <div className="max-w-md w-full bg-[var(--theme-surface)] p-8 rounded-3xl border border-[var(--theme-border)] text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="font-serif text-2xl font-bold">Order Details Unavailable</h2>
          <p className="text-xs text-[var(--theme-text-muted)]">
            Could not locate the requested order in the database.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    );
  }

  // Determine state
  const isPaid =
    ['confirmed', 'shipped', 'delivered'].includes(order.status) ||
    order.payments?.some((p) => p.status === 'captured');

  const isFailed = order.status === 'cancelled' || order.payments?.some((p) => p.status === 'failed');
  const isPending = !isPaid && !isFailed;
  const primaryPayment = order.payments?.[0];
  const addr = order.shipping_address || {};

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] py-8 sm:py-14 px-3 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10">

        {/* ========================================================= */}
        {/* State Banner: Confirmed / Pending / Failed                */}
        {/* ========================================================= */}
        {isPaid && (
          <div className="text-center space-y-3.5 p-6 sm:p-10 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-[0.2em] px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Payment Verified & Captured
            </span>
            <h1 className="font-serif text-2xl sm:text-4xl font-extrabold text-[var(--theme-text)]">
              Payment Successful
            </h1>
            <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] max-w-md mx-auto leading-relaxed">
              Thank you for choosing VARNYXA. Your transaction has been confirmed and our ateliers have begun crafting your bespoke edition.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <div className="px-3.5 py-1.5 bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] rounded-xl font-mono text-xs font-bold">
                Order Number: <span className="text-[var(--theme-primary)]">{order.order_number}</span>
              </div>
              {(order.payment_reference_id || primaryPayment?.reference_id) && (
                <div className="px-3.5 py-1.5 bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] rounded-xl font-mono text-xs font-bold">
                  Reference ID: <span className="text-[var(--theme-primary)]">{order.payment_reference_id || primaryPayment?.reference_id}</span>
                </div>
              )}
            </div>

            {/* Quick Action Buttons for Verified Payment */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleOpenReceipt}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Download Payment Receipt</span>
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface-alt)] transition"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        )}

        {isPending && (
          <div className="text-center space-y-4 p-6 sm:p-10 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-[0.2em] px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Payment Awaiting Confirmation
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-[var(--theme-text)]">
              Payment Verification Pending
            </h1>
            <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] max-w-md mx-auto leading-relaxed">
              We are awaiting payment confirmation from your bank or payment gateway. If you completed payment, click below to verify status:
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleVerifyPaymentStatus}
                disabled={isVerifying}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition cursor-pointer shadow-md disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>{isVerifying ? 'Verifying with Bank...' : 'I Have Completed Payment — Verify Status'}</span>
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface-alt)] transition"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="text-center space-y-4 p-6 sm:p-10 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-[0.2em] px-3.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Payment Unsuccessful
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-[var(--theme-text)]">
              Payment Was Declined or Cancelled
            </h1>
            <p className="text-xs sm:text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
              Your transaction was not completed. No money was captured from your account. You can retry checkout anytime.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/cart"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition shadow-md"
              >
                <span>Retry in Shopping Bag</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-semibold rounded-xl hover:bg-[var(--theme-surface-alt)] transition"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Order Status Timeline                                     */}
        {/* ========================================================= */}
        <div className="p-5 sm:p-8 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-4">
          <h3 className="font-serif text-base font-bold text-[var(--theme-text)] uppercase tracking-wider">
            Order Status: <span className="text-[var(--theme-primary)] capitalize">{order.status}</span>
          </h3>

          <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center mx-auto text-xs font-bold">1</div>
              <span className="font-semibold text-[var(--theme-text)] block">Placed</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">{formatDate(order.created_at)}</span>
            </div>

            <div className="space-y-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                order.status !== 'placed' && order.status !== 'pending' ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)]' : 'bg-[var(--theme-border)] text-[var(--theme-text-muted)]'
              }`}>2</div>
              <span className="font-semibold text-[var(--theme-text)] block">Confirmed</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">Atelier Assigned</span>
            </div>

            <div className="space-y-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                order.status === 'shipped' || order.status === 'delivered' ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)]' : 'bg-[var(--theme-border)] text-[var(--theme-text-muted)]'
              }`}>3</div>
              <span className="font-semibold text-[var(--theme-text)] block">Shipped</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">{order.courier_partner || 'Express Courier'}</span>
            </div>

            <div className="space-y-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                order.status === 'delivered' ? 'bg-emerald-700 text-white' : 'bg-[var(--theme-border)] text-[var(--theme-text-muted)]'
              }`}>4</div>
              <span className="font-semibold text-[var(--theme-text)] block">Delivered</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">{order.delivered_at ? formatDate(order.delivered_at) : 'Estimated 2-4 days'}</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Items and Financials Summary Grid                         */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Items column */}
          <div className="md:col-span-2 p-5 sm:p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-[var(--theme-text)] uppercase tracking-wider pb-3 border-b border-[var(--theme-border)] flex items-center justify-between">
              <span>Garments in this Edition</span>
              <span className="text-xs text-[var(--theme-text-muted)] font-sans font-normal">{order.items.length} items</span>
            </h3>
            <div className="space-y-4 divide-y divide-[var(--theme-border)]/50">
              {order.items.map((item) => (
                <div key={item.id} className="pt-4 first:pt-0 flex items-center gap-3 sm:gap-4">
                  <div className="w-14 h-18 sm:w-16 sm:h-20 bg-[var(--theme-surface-alt)] rounded-xl overflow-hidden shrink-0 border border-[var(--theme-border)]">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs text-[var(--theme-text-muted)]">
                        {item.product_title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs sm:text-sm text-[var(--theme-text)] truncate">{item.product_title}</h4>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                      Size: <strong>{item.size}</strong> • Color: <strong>{item.color_name}</strong>
                    </p>
                    <p className="text-xs text-[var(--theme-text-muted)]">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[var(--theme-text)] font-mono">
                      {formatPrice(item.total_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Address and Financials Column */}
          <div className="space-y-4 sm:space-y-6">
            {/* Delivery address */}
            <div className="p-5 sm:p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-2.5 text-xs">
              <h4 className="font-serif text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--theme-primary)]" />
                <span>Shipping Details</span>
              </h4>
              <div className="text-[var(--theme-text-muted)] space-y-1 pt-1 leading-relaxed">
                <p className="font-bold text-[var(--theme-text)]">{addr.full_name}</p>
                <p>{addr.address_line1}</p>
                {addr.address_line2 && <p>{addr.address_line2}</p>}
                <p>{addr.city}, {addr.state} - {addr.postal_code}</p>
                <p className="font-mono pt-1 text-[var(--theme-text-muted)]">Phone: {addr.phone}</p>
              </div>
            </div>

            {/* Financial summary */}
            <div className="p-5 sm:p-6 bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] shadow-sm space-y-2 text-xs text-[var(--theme-text)]">
              <h4 className="font-serif text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider pb-2 border-b border-[var(--theme-border)]">
                Payment Breakdown
              </h4>
              <div className="flex justify-between">
                <span className="text-[var(--theme-text-muted)]">Subtotal</span>
                <span className="font-mono">{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Coupon ({order.coupon_code || 'PROMO'})</span>
                  <span className="font-mono">-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--theme-text-muted)]">
                <span>Delivery</span>
                <span className={`font-mono ${order.shipping_fee === 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
                  {order.shipping_fee === 0 ? 'FREE' : formatPrice(order.shipping_fee)}
                </span>
              </div>
              <div className="flex justify-between text-[var(--theme-text-muted)]">
                <span>GST ({order.tax_rate ?? 18}%)</span>
                <span className="font-mono">{formatPrice(order.tax_amount)}</span>
              </div>

              {primaryPayment && (
                <div className="pt-2 border-t border-[var(--theme-border)] space-y-1 text-[11px] text-[var(--theme-text-muted)]">
                  <div className="flex justify-between">
                    <span>Gateway:</span>
                    <span className="font-semibold text-[var(--theme-text)]">
                      {primaryPayment.provider === 'payyantra' ? 'PayYantra Hosted' : 'Razorpay Secure'}
                    </span>
                  </div>
                  {primaryPayment.payment_method && (
                    <div className="flex justify-between">
                      <span>Method:</span>
                      <span className="font-semibold text-[var(--theme-text)]">
                        {primaryPayment.payment_method.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {primaryPayment.rrn && (
                    <div className="flex justify-between">
                      <span>RRN:</span>
                      <span className="font-mono text-[var(--theme-text)]">{primaryPayment.rrn}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between text-sm font-extrabold text-[var(--theme-text)] pt-2.5 border-t border-[var(--theme-border)]">
                <span>Total Amount</span>
                <span className="text-[var(--theme-primary)] font-mono">
                  {formatPrice(order.total_amount)}
                </span>
              </div>

              {/* Receipt Action Button */}
              {isPaid && (
                <button
                  type="button"
                  onClick={handleOpenReceipt}
                  className="w-full mt-3 py-2.5 bg-[var(--theme-surface-alt)] hover:bg-[var(--theme-border)] border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                  <span>Download Tax Invoice Receipt</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Navigation Links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            to="/account?tab=orders"
            className="w-full sm:w-auto px-8 py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition text-center shadow-md"
          >
            View in My Orders
          </Link>
          <Link
            to="/shop"
            className="w-full sm:w-auto px-8 py-3.5 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[var(--theme-surface-alt)] transition text-center"
          >
            Continue Shopping
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto px-6 py-3.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-semibold rounded-xl text-center transition"
          >
            Return to Home
          </Link>
        </div>

      </div>

      {/* Official Receipt Modal */}
      {receiptData && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          receipt={receiptData}
        />
      )}
    </div>
  );
};
