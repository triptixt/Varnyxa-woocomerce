import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Lock,
  Loader2,
  X,
  Zap,
  Building2,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Address, PaymentConfig, Order, PayYantraCheckoutResponse, RazorpayOrderResponse } from '../types';
import { api } from '../services/api';
import { formatPrice } from '../utils/formatters';

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const CheckoutPage: React.FC = () => {
  const { cart, refreshCart, removeItem, clearCart, applyCoupon } = useCart();
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(false);
  const [showAddressPicker, setShowAddressPicker] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProvider, setProcessingProvider] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Demo QR & Demo VPA States
  const [demoQrDataUrl, setDemoQrDataUrl] = useState<string>('');
  const [isCopiedVpa, setIsCopiedVpa] = useState<boolean>(false);
  const sampleVpa = 'vidyapath@okhdfcbank';

  const [couponInput, setCouponInput] = useState<string>('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);

  // New Address Form State
  const [newAddress, setNewAddress] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    address_type: 'Home',
  });

  // Redirect if cart is empty and no pending order
  useEffect(() => {
    if (!createdOrder && (!cart || cart.items.length === 0)) {
      navigate('/cart');
    }
  }, [cart, createdOrder, navigate]);

  // Generate genuine complete scannable demo QR code dynamically
  useEffect(() => {
    const demoPayload = 'VARNYXA-DEMO-TRANSACTION-12345';
    QRCode.toDataURL(demoPayload, {
      width: 280,
      margin: 4, // 4 quiet-zone modules per ISO standard
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setDemoQrDataUrl(url))
      .catch((err) => console.error('Demo QR generation error:', err));
  }, []);

  // Load saved addresses and payment config
  useEffect(() => {
    const initCheckout = async () => {
      try {
        const config = await api.payments.getConfig();
        setPaymentConfig(config);

        if (user) {
          const addrs = await api.addresses.list();
          setAddresses(addrs);
          const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
          } else {
            setIsAddingNewAddress(true);
          }
        } else {
          setIsAddingNewAddress(true);
        }
      } catch (err: any) {
        console.error('Checkout initialization error:', err);
      }
    };

    initCheckout();
  }, [user]);

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setIsAddingNewAddress(false);
      return;
    }
    try {
      const created = await api.addresses.create(newAddress);
      setAddresses([...addresses, created]);
      setSelectedAddressId(created.id);
      setIsAddingNewAddress(false);
      setShowAddressPicker(false);
      success('Shipping address saved.');
    } catch (err: any) {
      error(err.message || 'Could not save address.');
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setIsApplyingCoupon(true);
    try {
      await applyCoupon(couponInput.trim());
      setCouponInput('');
    } catch {
      // toast shown in context
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Helper: Prepare or obtain current valid order
  const getOrCreateOrder = async (providerChoice: 'payyantra' | 'razorpay' | 'demo'): Promise<Order> => {
    if (createdOrder) return createdOrder;

    const orderPayload: any = {
      payment_provider: providerChoice,
      coupon_code: cart?.coupon_code || undefined,
    };

    if (selectedAddressId) {
      orderPayload.address_id = selectedAddressId;
    } else {
      orderPayload.shipping_address = newAddress;
    }

    const newOrder = await api.orders.create(orderPayload);
    setCreatedOrder(newOrder);
    return newOrder;
  };

  // =========================================================================
  // 1. Direct PayYantra Hosted Checkout Redirect (Section 2)
  // =========================================================================
  const handlePayYantraCheckout = async () => {
    if (!user) {
      info('Please sign in or create an account to proceed with your order.');
      navigate('/login?redirect=/checkout');
      return;
    }

    if (!selectedAddressId && !newAddress.address_line1) {
      error('Please select or enter a delivery address before proceeding.');
      setShowAddressPicker(true);
      return;
    }

    setIsProcessing(true);
    setProcessingProvider('payyantra');

    try {
      const order = await getOrCreateOrder('payyantra');
      const returnUrl = `${window.location.origin}/payment/payyantra/callback`;
      
      const pyOrder: PayYantraCheckoutResponse = await api.payments.createPayYantraCheckout(
        order.id,
        'CARD',
        returnUrl
      );

      if (!pyOrder.checkout_url) {
        throw new Error('Payment gateway did not return a valid checkout URL.');
      }

      // Security validation: ensure URL is HTTPS and points to trusted PayYantra domain
      if (!pyOrder.checkout_url.startsWith('https://')) {
        throw new Error('Insecure checkout URL received from payment provider.');
      }

      const parsedUrl = new URL(pyOrder.checkout_url);
      const trustedDomains = ['payyantra.com', 'simulator.payyantra.com'];
      const isTrusted = trustedDomains.some(
        (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
      );

      if (!isTrusted) {
        throw new Error(`Untrusted payment domain: ${parsedUrl.hostname}`);
      }

      // Direct redirection to official hosted checkout without intermediate screens
      window.location.href = pyOrder.checkout_url;
    } catch (err: any) {
      error(err.message || 'Failed to initiate PayYantra hosted checkout.');
      setIsProcessing(false);
      setProcessingProvider(null);
    }
  };

  // =========================================================================
  // 2. Direct Razorpay Official Checkout (Section 4)
  // =========================================================================
  const handleRazorpayCheckout = async () => {
    if (!user) {
      info('Please sign in or create an account to proceed with your order.');
      navigate('/login?redirect=/checkout');
      return;
    }

    if (!selectedAddressId && !newAddress.address_line1) {
      error('Please select or enter a delivery address before proceeding.');
      setShowAddressPicker(true);
      return;
    }

    setIsProcessing(true);
    setProcessingProvider('razorpay');

    try {
      const order = await getOrCreateOrder('razorpay');
      const rpOrder: RazorpayOrderResponse = await api.payments.createRazorpayOrder(order.id, 'card');

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay payment gateway failed to load. Please check your network connection.');
      }

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
        theme: {
          color: '#18181B',
        },
        handler: async function (response: any) {
          try {
            setIsProcessing(true);
            const verifyRes = await api.payments.verifyRazorpay({
              order_id: order.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyRes.verified) {
              await refreshCart();
              success('Payment verified successfully! Your VARNYXA order is confirmed.');
              navigate(`/order-confirmation/${order.id}`);
            } else {
              error('Payment verification failed on the server. Please contact concierge support.');
            }
          } catch (vErr: any) {
            error(vErr.message || 'Error verifying payment signature.');
          } finally {
            setIsProcessing(false);
            setProcessingProvider(null);
          }
        },
        modal: {
          confirm_close: true,
          ondismiss: function () {
            setIsProcessing(false);
            setProcessingProvider(null);
            info('Payment session closed. You may retry payment whenever you are ready.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        error(resp.error?.description || 'Payment was declined by the bank/provider.');
        setIsProcessing(false);
        setProcessingProvider(null);
      });
      rzp.open();
    } catch (err: any) {
      error(err.message || 'Razorpay checkout initiation failed.');
    } finally {
      setIsProcessing(false);
      setProcessingProvider(null);
    }
  };

  // =========================================================================
  // 3. Demo Payment Completion Flow (Sections 2 & 3)
  // =========================================================================
  const handleCompleteDemoPayment = async () => {
    if (!cart) return;

    if (!user) {
      info('Please sign in or create an account to complete your order.');
      navigate('/login?redirect=/checkout');
      return;
    }

    if (!selectedAddressId && !newAddress.address_line1) {
      error('Please select or enter a delivery address before proceeding.');
      setShowAddressPicker(true);
      return;
    }

    setIsProcessing(true);
    setProcessingProvider('demo');

    try {
      // 1. Ensure order is created and persisted in PostgreSQL
      const order = await getOrCreateOrder('demo');

      const demoRef = `PAYREF-DEMO-${Math.floor(100000 + Math.random() * 900000)}`;

      // 2. Call backend endpoint to persist distinct demo transaction in database
      const confirmedOrder = await api.payments.completeDemoPayment({
        order_id: order.id,
        payment_method: 'UPI QR (Seamless Demo)',
        reference_id: demoRef,
      });

      const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || order.shipping_address;

      const demoSnapshot = {
        isDemo: true,
        orderNumber: confirmedOrder.order_number,
        orderId: confirmedOrder.id,
        paymentReference: demoRef,
        paymentMethod: 'UPI QR (Seamless Demo)',
        paymentGateway: 'VARNYXA Seamless UPI Rails',
        paidAt: new Date().toISOString(),
        customerName: user?.full_name || selectedAddress?.full_name || 'Valued Client (Demo)',
        customerEmail: user?.email || 'client@varnyxa.com',
        customerPhone: user?.phone || selectedAddress?.phone || '9876543210',
        shippingAddress: confirmedOrder.shipping_address || selectedAddress,
        items: confirmedOrder.items.map((it: any) => ({
          id: it.id,
          product_title: it.product_title,
          size: it.size,
          color_name: it.color_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          image_url: it.image_url,
        })),
        subtotal: confirmedOrder.subtotal,
        discountAmount: confirmedOrder.discount_amount,
        couponCode: confirmedOrder.coupon_code,
        shippingFee: confirmedOrder.shipping_fee,
        taxAmount: confirmedOrder.tax_amount,
        taxRate: confirmedOrder.tax_rate ?? 18,
        totalAmount: confirmedOrder.total_amount,
        currency: confirmedOrder.currency || 'INR',
      };

      // Store in sessionStorage so immediate receipt generation has fast cache
      sessionStorage.setItem('varnyxa_demo_order', JSON.stringify(demoSnapshot));

      // Clear cart so client shopping bag reflects the completed checkout
      try {
        await clearCart();
      } catch {
        // ignore
      }

      success('Demo payment recorded and order confirmed!');
      // Navigate to order confirmation page with the real persisted order ID
      navigate(`/order-confirmation/${confirmedOrder.id}`, { state: { demoOrder: demoSnapshot } });
    } catch (err: any) {
      error(err.message || 'Failed to complete demo payment.');
    } finally {
      setIsProcessing(false);
      setProcessingProvider(null);
    }
  };

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(sampleVpa);
    setIsCopiedVpa(true);
    success('Copied VPA to clipboard.');
    setTimeout(() => setIsCopiedVpa(false), 2000);
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  if (!cart) return null;

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] py-8 sm:py-14 px-3 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* 2-Column Grid Matching Reference Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

          {/* ========================================================= */}
          {/* LEFT COLUMN: Order Summary                                */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[var(--theme-surface)] rounded-3xl border border-[var(--theme-border)] p-5 sm:p-6 shadow-sm space-y-5">
              <h2 className="font-serif text-lg font-bold text-[var(--theme-text)] tracking-tight">
                Order Summary
              </h2>

              {/* Items List */}
              <div className="space-y-4 divide-y divide-[var(--theme-border)]/60">
                {cart.items.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Product Thumbnail */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)] flex items-center justify-center font-bold text-xs shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{item.product_title.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Product Name & Details */}
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs sm:text-sm text-[var(--theme-text)] truncate">
                          {item.product_title}
                        </h4>
                        <p className="text-[11px] text-[var(--theme-text-muted)] truncate">
                          Size: {item.size} • Qty: {item.quantity}
                        </p>
                      </div>
                    </div>

                    {/* Price and Remove Button */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-bold text-xs sm:text-sm text-[var(--theme-text)] font-mono">
                        {formatPrice(item.total_price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="w-6 h-6 rounded-full border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-text-muted)] hover:text-rose-500 hover:border-rose-400 transition cursor-pointer"
                        title="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Input Form */}
              <form onSubmit={handleApplyCoupon} className="pt-3 border-t border-[var(--theme-border)] flex gap-2">
                <input
                  type="text"
                  placeholder="Promo Code (e.g. WELCOME500)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)] uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-primary)]"
                />
                <button
                  type="submit"
                  disabled={isApplyingCoupon || !couponInput.trim()}
                  className="px-4 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition cursor-pointer"
                >
                  {isApplyingCoupon ? 'Applying...' : 'Apply'}
                </button>
              </form>

              {/* Cost Calculations */}
              <div className="space-y-2 text-xs text-[var(--theme-text-muted)] pt-3 border-t border-[var(--theme-border)]">
                <div className="flex justify-between text-[var(--theme-text)]">
                  <span>Subtotal</span>
                  <span className="font-semibold font-mono">{formatPrice(cart.subtotal)}</span>
                </div>

                {cart.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Coupon ({cart.coupon_code || 'PROMO'})</span>
                    <span className="font-mono">-{formatPrice(cart.discount_amount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[11px]">
                  <span>GST Included ({cart.tax_rate ?? 18}%)</span>
                  <span className="font-mono">{formatPrice(cart.tax_amount)}</span>
                </div>

                {cart.shipping_fee > 0 ? (
                  <div className="flex justify-between text-[var(--theme-text)]">
                    <span>Shipping Charges</span>
                    <span className="font-semibold font-mono">{formatPrice(cart.shipping_fee)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Delivery</span>
                    <span className="uppercase text-[10px] tracking-wider font-bold">Complimentary Express</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[var(--theme-border)] flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[var(--theme-text)]">Total Payable</span>
                  <span className="text-xl font-extrabold text-[var(--theme-primary)] font-mono">
                    {formatPrice(cart.total_amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Address Pill Card */}
            <div className="bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] p-4 shadow-sm text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                  <span>Delivery Address</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddressPicker(true)}
                  className="text-[var(--theme-primary)] font-bold hover:underline cursor-pointer"
                >
                  {selectedAddress ? 'Change' : 'Add Address'}
                </button>
              </div>

              {selectedAddress ? (
                <div className="text-[var(--theme-text-muted)] text-[11px] leading-relaxed">
                  <p className="font-semibold text-[var(--theme-text)]">{selectedAddress.full_name}</p>
                  <p>{selectedAddress.address_line1}{selectedAddress.address_line2 ? `, ${selectedAddress.address_line2}` : ''}</p>
                  <p>{selectedAddress.city}, {selectedAddress.state} - {selectedAddress.postal_code}</p>
                  <p className="font-mono text-[var(--theme-text-muted)]">{selectedAddress.phone}</p>
                </div>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 text-[11px]">
                  No delivery address selected. Please add one to place an order.
                </p>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Payment Section                             */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-5">

            {/* Top User Account Badge Card */}
            <div className="bg-[#eef2ff] dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                  CLIENT ACCOUNT VERIFIED
                </span>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                  {user ? `${user.full_name || 'Client'} (${user.email})` : 'test (test123@gmail.com)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login?redirect=/checkout')}
                className="px-4 py-1.5 text-xs font-semibold rounded-full border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer shadow-sm"
              >
                Switch
              </button>
            </div>

            {/* Section Heading */}
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-serif">
                Select Payment Mode
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose your payment mode. Clicking will directly launch that gateway's checkout:
              </p>
            </div>

            {/* Gateway Card 1: PayYantra (Direct Hosted Checkout) */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    🚀
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      PayYantra
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Official Hosted Payment Gateway
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-md">
                  UAT Sandbox
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Directly opens PayYantra's official checkout page. Supports PhonePe, Google Pay, Paytm, BHIM, RuPay, Visa, MasterCard, and 50+ Banks.
              </p>

              <button
                type="button"
                onClick={handlePayYantraCheckout}
                disabled={isProcessing}
                className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isProcessing && processingProvider === 'payyantra' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to PayYantra...</span>
                  </>
                ) : (
                  <span>Pay with PayYantra ({formatPrice(cart.total_amount)}) →</span>
                )}
              </button>
            </div>

            {/* Gateway Card 2: Razorpay (Direct In-Page Checkout) */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    ⚡
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Razorpay / Direct Rails
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Direct Payment Rails & PCI-DSS Cards
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-md">
                  Direct QR & Cards
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Opens official Razorpay Checkout interface directly with instant UPI QR code, UPI collect handles, and debit/credit cards.
              </p>

              <button
                type="button"
                onClick={handleRazorpayCheckout}
                disabled={isProcessing}
                className="w-full py-3 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isProcessing && processingProvider === 'razorpay' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Launching Razorpay Checkout...</span>
                  </>
                ) : (
                  <span>Pay with Razorpay ({formatPrice(cart.total_amount)}) →</span>
                )}
              </button>
            </div>

            {/* ========================================================= */}
            {/* Gateway Card 3: Seamless UPI Payment (Matching Reference) */}
            {/* ========================================================= */}
            <div className="border-2 border-[#22c55e] bg-[#f0fdf4] dark:bg-[#14532d]/15 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold text-lg">⚡</span>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Seamless UPI Payment
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Scan QR Code or Tap any UPI App to Pay
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Instant UPI
                </span>
              </div>

              {/* Tap to Pay with UPI App Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span>📱</span>
                    <span>Tap to Pay with UPI App:</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    Instant 1-Tap Redirect
                  </span>
                </div>

                {/* 4 UPI App Preview Buttons Matching Reference Screenshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Google Pay */}
                  <button
                    type="button"
                    onClick={() => info('Opening Google Pay UPI intent...')}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Google Pay</span>
                  </button>

                  {/* PhonePe */}
                  <button
                    type="button"
                    onClick={() => info('Opening PhonePe UPI intent...')}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#5f259f] text-white flex items-center justify-center text-[10px] font-extrabold">
                      पे
                    </div>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">PhonePe</span>
                  </button>

                  {/* Paytm */}
                  <button
                    type="button"
                    onClick={() => info('Opening Paytm UPI intent...')}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span className="text-[10px] font-black text-[#00b9f5] tracking-tighter">Paytm</span>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Paytm</span>
                  </button>

                  {/* Any UPI App */}
                  <button
                    type="button"
                    onClick={() => info('Opening UPI application selector...')}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <div className="w-5 h-5 flex items-center justify-center text-emerald-600 font-bold text-xs">
                      ⚡
                    </div>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">Any UPI App</span>
                  </button>
                </div>
              </div>

              {/* Or Scan UPI QR Code Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  OR SCAN UPI QR CODE
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* Centered White QR Container Matching Reference Image */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-center space-y-3.5 shadow-sm">
                
                {/* Complete, Sharp, Validly Encoded ISO QR Image */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 inline-block shadow-inner mx-auto">
                  {demoQrDataUrl ? (
                    <img
                      src={demoQrDataUrl}
                      alt="Scannable Seamless Demo QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center bg-gray-100 text-gray-400 font-mono text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Scan with PhonePe, Google Pay, Paytm, Cred or BHIM
                </p>

                {/* VPA Box with Working Copy Button */}
                <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                  <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>VPA:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{sampleVpa}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyVpa}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Copy sample VPA"
                  >
                    {isCopiedVpa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopiedVpa ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Bottom Prominent Green Button: "I Have Completed Payment" */}
              <button
                type="button"
                onClick={handleCompleteDemoPayment}
                className="w-full py-3.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>✓ I Have Completed Payment ({formatPrice(cart.total_amount)}) — Unlock Order</span>
              </button>
            </div>

            {/* Bottom Footer Security Badges (Matching Reference Screenshot) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg">
                <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">Instant Order Access</span>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg">
                <Lock className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="truncate">256-bit TLS Encryption</span>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg">
                <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="truncate">GST Tax Invoice</span>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg">
                <Building2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="truncate">Official Bank Rails</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Shipping Address Picker Modal                             */}
      {/* ========================================================= */}
      {showAddressPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[var(--theme-surface)] text-[var(--theme-text)] rounded-3xl p-6 border border-[var(--theme-border)] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddressPicker(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-serif font-bold text-base text-[var(--theme-text)] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--theme-primary)]" />
              <span>Select Shipping Address</span>
            </h3>

            {/* Saved Addresses List */}
            {addresses.length > 0 && (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition text-xs ${
                      selectedAddressId === addr.id
                        ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-alt)]'
                        : 'border-[var(--theme-border)] hover:border-[var(--theme-text-muted)]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="shippingAddress"
                        checked={selectedAddressId === addr.id}
                        onChange={() => {
                          setSelectedAddressId(addr.id);
                          setShowAddressPicker(false);
                        }}
                        className="mt-0.5 accent-[var(--theme-primary)]"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-[var(--theme-text)]">{addr.full_name}</span>
                        <p className="text-[var(--theme-text-muted)] mt-0.5">
                          {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}
                        </p>
                        <p className="text-[var(--theme-text-muted)]">{addr.city}, {addr.state} - {addr.postal_code}</p>
                        <p className="font-mono text-[var(--theme-text-muted)] mt-0.5">{addr.phone}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Toggle Add New Address */}
            <div className="pt-2 border-t border-[var(--theme-border)]">
              <button
                type="button"
                onClick={() => setIsAddingNewAddress(!isAddingNewAddress)}
                className="text-xs font-semibold text-[var(--theme-primary)] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingNewAddress ? 'Hide New Address Form' : 'Add New Address'}</span>
              </button>

              {isAddingNewAddress && (
                <form onSubmit={handleCreateAddress} className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={newAddress.full_name}
                      onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="10-digit Phone"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Street Address, House No."
                    value={newAddress.address_line1}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                    />
                    <input
                      type="text"
                      required
                      placeholder="State"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Pincode"
                      value={newAddress.postal_code}
                      onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--theme-surface-alt)] border border-[var(--theme-border)] text-[var(--theme-text)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-semibold rounded-xl hover:opacity-90"
                    >
                      Save & Use
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewAddress(false)}
                      className="px-4 py-2 border border-[var(--theme-border)] text-xs font-semibold rounded-xl text-[var(--theme-text)] hover:bg-[var(--theme-surface-alt)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
