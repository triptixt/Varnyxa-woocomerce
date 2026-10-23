import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  CreditCard,
  Building2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { api } from '../../services/api';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentMethod: 'upi' | 'card' | 'netbanking';
  provider: 'payyantra' | 'razorpay';
  checkoutUrl?: string | null;
  qrData?: string | null;
  qrUrl?: string | null;
  upiIntentUrl?: string | null;
  expiresAt?: string | null;
  onSuccess: (orderId: string) => void;
  onError: (errorMsg: string) => void;
}

export const CustomPaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  amount,
  paymentMethod,
  provider,
  checkoutUrl,
  qrData,
  qrUrl,
  upiIntentUrl,
  expiresAt,
  onSuccess,
  onError,
}) => {
  const [paymentState, setPaymentState] = useState<'pending' | 'verifying' | 'success' | 'failed'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minute default countdown
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);
  const pollIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Determine if direct dynamic QR is available
  const hasDirectQr = Boolean(qrData || qrUrl);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;

    // Calculate remaining seconds if expiresAt is provided
    if (expiresAt) {
      const expDate = new Date(expiresAt).getTime();
      const diffSecs = Math.max(10, Math.floor((expDate - Date.now()) / 1000));
      setTimeRemaining(diffSecs);
    } else {
      setTimeRemaining(600);
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, expiresAt]);

  // Status check logic
  const checkStatus = async (isManual = false) => {
    if (isManual) setIsManualChecking(true);
    try {
      if (provider === 'razorpay') {
        const res = await api.payments.getRazorpayStatus(orderId);
        if (res.payment_status === 'captured') {
          setPaymentState('success');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setTimeout(() => onSuccess(orderId), 1500);
          return true;
        } else if (res.payment_status === 'failed') {
          setPaymentState('failed');
          setErrorMessage('Payment authorization was declined.');
          return false;
        }
      } else {
        const res = await api.payments.getPayYantraStatus(orderId);
        if (res.payment_status === 'captured') {
          setPaymentState('success');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setTimeout(() => onSuccess(orderId), 1500);
          return true;
        } else if (res.payment_status === 'failed') {
          setPaymentState('failed');
          setErrorMessage(res.error_description || 'Payment was declined or cancelled by the provider.');
          return false;
        }
      }
    } catch (err: any) {
      // Background checks fail silently to avoid toast spam
      if (isManual) {
        setErrorMessage(err.message || 'Payment is still processing with the bank.');
      }
    } finally {
      if (isManual) setIsManualChecking(false);
    }
    return false;
  };

  // Continuous background polling while modal is open and pending
  useEffect(() => {
    if (!isOpen || paymentState !== 'pending') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    // Initial check after 2 seconds
    const initialTimer = setTimeout(() => {
      checkStatus();
    }, 2000);

    // Regular polling every 3.5 seconds
    pollIntervalRef.current = setInterval(() => {
      checkStatus();
    }, 3500);

    return () => {
      clearTimeout(initialTimer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, paymentState, orderId, provider]);

  if (!isOpen) return null;

  // Format seconds into MM:SS
  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLaunchHosted = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl p-5 sm:p-8 shadow-2xl text-left space-y-5 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg)] transition cursor-pointer"
          title="Close payment window"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success View */}
        {paymentState === 'success' ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-[var(--theme-text)]">Payment Verified!</h3>
              <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                Order <span className="font-mono font-bold text-[var(--theme-text)]">#{orderNumber}</span> has been confirmed. Redirecting...
              </p>
            </div>
          </div>
        ) : paymentState === 'failed' ? (
          /* Failed View */
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[var(--theme-text)]">Payment Unsuccessful</h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-sm mx-auto">
                {errorMessage || 'The payment session timed out or was declined.'}
              </p>
            </div>
            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => setPaymentState('pending')}
                className="px-5 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase rounded-xl hover:opacity-90"
              >
                Retry Payment
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 border border-[var(--theme-border)] text-xs font-semibold rounded-xl text-[var(--theme-text)]"
              >
                Cancel & Review Order
              </button>
            </div>
          </div>
        ) : (
          /* Active Pending View */
          <>
            {/* Modal Header */}
            <div className="border-b border-[var(--theme-border)] pb-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-primary)] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>256-Bit Encrypted Banking Interface</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--theme-text-muted)] bg-[var(--theme-bg)] px-2 py-0.5 rounded border border-[var(--theme-border)]">
                  {provider.toUpperCase()}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="font-serif text-2xl font-extrabold text-[var(--theme-text)]">
                  {formatPrice(amount)}
                </h3>
                <span className="text-xs text-[var(--theme-text-muted)]">
                  Order <span className="font-mono font-semibold text-[var(--theme-text)]">#{orderNumber}</span>
                </span>
              </div>
            </div>

            {/* Method-Specific Content */}
            {paymentMethod === 'upi' ? (
              <div className="space-y-4">
                {hasDirectQr ? (
                  /* Mode A: In-Page Dynamic UPI QR */
                  <div className="text-center space-y-3">
                    <div className="p-3 bg-white rounded-2xl border border-[var(--theme-border)] inline-block shadow-inner mx-auto">
                      <img
                        src={
                          qrUrl ||
                          (qrData && qrData.startsWith('http')
                            ? qrData
                            : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                                qrData || ''
                              )}`)
                        }
                        alt="Dynamic UPI QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-[var(--theme-text)] flex items-center justify-center gap-1.5">
                        <QrCode className="w-4 h-4 text-[var(--theme-primary)]" />
                        <span>Scan with any UPI app to pay</span>
                      </p>
                      <p className="text-[11px] text-[var(--theme-text-muted)]">
                        Google Pay • PhonePe • Paytm • Cred • BHIM
                      </p>
                    </div>

                    {upiIntentUrl && (
                      <a
                        href={upiIntentUrl}
                        className="w-full py-3 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-md transition"
                      >
                        <span>Open in UPI App</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  /* Mode B: Direct UPI Session (When in-page QR is awaiting PSP activation on gateway) */
                  <div className="p-4 bg-[var(--theme-surface-alt)] rounded-2xl border border-[var(--theme-border)] space-y-3 text-center">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--theme-text)]">
                        Direct UPI Payment Ready
                      </h4>
                      <p className="text-xs text-[var(--theme-text-muted)] mt-1 leading-relaxed">
                        Your transaction of <strong className="text-[var(--theme-text)]">{formatPrice(amount)}</strong> is initialized for UPI payment.
                      </p>
                    </div>

                    <div className="p-3 bg-[var(--theme-bg)] rounded-xl border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] text-left space-y-1">
                      <div className="flex items-center gap-1 text-[var(--theme-text)] font-semibold">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dedicated UPI Instrument Channel</span>
                      </div>
                      <p>
                        Filtered specifically to UPI. No generic method browsing required.
                      </p>
                    </div>

                    {checkoutUrl && (
                      <button
                        onClick={handleLaunchHosted}
                        className="w-full py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                      >
                        <span>Proceed to UPI Payment</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : paymentMethod === 'card' ? (
              /* Card Specific Flow */
              <div className="p-4 bg-[var(--theme-surface-alt)] rounded-2xl border border-[var(--theme-border)] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--theme-text)]">
                      Level 1 PCI-DSS Secure Card Interface
                    </h4>
                    <p className="text-xs text-[var(--theme-text-muted)]">
                      Visa • MasterCard • RuPay • American Express
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[var(--theme-bg)] rounded-xl border border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] space-y-1">
                  <p className="font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>RBI Directive Compliant Tokenization</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Card numbers and CVVs are handled exclusively by verified Level 1 PCI-DSS certified banking processors. Raw credentials never touch VARNYXA servers.
                  </p>
                </div>

                {checkoutUrl && (
                  <button
                    onClick={handleLaunchHosted}
                    className="w-full py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <span>Open Secure Card Payment Portal</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              /* Netbanking Flow */
              <div className="p-4 bg-[var(--theme-surface-alt)] rounded-2xl border border-[var(--theme-border)] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--theme-text)]">NetBanking Gateway</h4>
                    <p className="text-xs text-[var(--theme-text-muted)]">50+ Supported Indian Retail & Corporate Banks</p>
                  </div>
                </div>

                {checkoutUrl && (
                  <button
                    onClick={handleLaunchHosted}
                    className="w-full py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <span>Proceed to Bank Portal</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Status Footer & Countdown */}
            <div className="pt-2 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-text-muted)]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--theme-primary)]" />
                <span className="text-[11px]">Awaiting bank confirmation...</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--theme-text)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
                  <span>{formatTimer(timeRemaining)}</span>
                </span>

                <button
                  onClick={() => checkStatus(true)}
                  disabled={isManualChecking}
                  className="p-1.5 rounded-lg border border-[var(--theme-border)] hover:bg-[var(--theme-bg)] transition text-[var(--theme-text)] disabled:opacity-50 cursor-pointer"
                  title="Check payment status now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isManualChecking ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
