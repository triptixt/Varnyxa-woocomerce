import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, CheckCircle2, Zap, Truck, ShieldCheck, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { SubscriptionPlan, UserSubscription } from '../types';
import { formatPrice } from '../utils/formatters';

export const SubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const plansData = await api.subscriptions.getPlans();
      setPlans(plansData);

      if (user) {
        try {
          const subData = await api.subscriptions.getMySubscription();
          setActiveSubscription(subData);
        } catch {
          setActiveSubscription(null);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) {
      info('Please sign in to join VARNYXA Privé');
      navigate('/login?redirect=/membership');
      return;
    }

    try {
      setSubscribingPlanId(plan.id);
      const res = await api.subscriptions.subscribe({
        plan_id: plan.id,
        payment_method: 'payyantra',
      });

      if (res.checkout_url) {
        // Redirect to PayYantra checkout gateway
        window.location.href = res.checkout_url;
      } else {
        success(res.message || `Welcome to VARNYXA Privé! ${plan.name} is now active.`);
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Failed to activate subscription');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] transition-colors duration-300">
      {/* Hero Header */}
      <div className="relative border-b border-[var(--theme-border)] bg-[var(--theme-surface)] py-16 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] font-semibold text-xs tracking-wider uppercase mb-4 border border-[var(--theme-primary)]/20">
            <Crown className="w-4 h-4" />
            VARNYXA PRIVÉ MEMBERSHIP
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Elevate Your Luxury Wardrobe
          </h1>
          <p className="text-base sm:text-lg text-[var(--theme-text-muted)] max-w-2xl mx-auto leading-relaxed">
            Enjoy unlimited free delivery with zero minimum order, VIP secret discounts, and early access to high-fashion drops.
          </p>

          {/* Active Membership Status Alert */}
          {activeSubscription && activeSubscription.is_active && (
            <div className="mt-8 p-5 rounded-2xl bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 text-left max-w-xl mx-auto shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-[var(--theme-text)]">
                      Active: {activeSubscription.plan_name}
                    </h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                      {activeSubscription.days_remaining} Days Left
                    </span>
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                    Valid until {new Date(activeSubscription.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="mt-3 text-xs text-[var(--theme-text)] font-medium">
                    Payment Ref: <span className="font-mono text-[var(--theme-primary)]">{activeSubscription.payment_reference}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Value Proposition Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Zero Delivery Fee</h3>
            <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">
              Order anything anytime with zero shipping charges, bypassing the standard ₹1,499 minimum cart threshold.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Exclusive VIP Discounts</h3>
            <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">
              Enjoy members-only discounts on seasonal apparel, runway edits, and designer collaborations.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">Early Access Drops</h3>
            <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed">
              Preview new collections 24 hours before public release and grab limited-stock couture before anyone else.
            </p>
          </div>
        </div>

        {/* Pricing Plans Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold tracking-tight">Choose Your Membership Tier</h2>
          <p className="mt-2 text-sm text-[var(--theme-text-muted)]">
            One-time payment with manual renewal. No unexpected automatic recurring debits.
          </p>
        </div>

        {/* Pricing Cards */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const isAnnual = plan.code.includes('annual');
              const isCurrent = activeSubscription?.plan_code === plan.code && activeSubscription?.is_active;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 border ${
                    isAnnual
                      ? 'bg-[var(--theme-surface)] border-[var(--theme-primary)] shadow-xl ring-2 ring-[var(--theme-primary)]/20 md:-translate-y-2'
                      : 'bg-[var(--theme-surface)] border-[var(--theme-border)] shadow-sm hover:shadow-lg'
                  }`}
                >
                  {isAnnual && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md">
                      Best Value • Save 33%
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="text-xs text-[var(--theme-text-muted)]">
                      / {plan.duration_days} days
                    </span>
                  </div>

                  <div className="border-t border-[var(--theme-border)] pt-6 mb-8 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] mb-4">
                      What's Included:
                    </p>
                    <ul className="space-y-3">
                      {plan.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-[var(--theme-text)]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isCurrent || subscribingPlanId === plan.id}
                    className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-default'
                        : isAnnual
                        ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] hover:opacity-90 shadow-md hover:shadow-lg'
                        : 'bg-[var(--theme-surface)] border-2 border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-[var(--theme-primary-contrast)]'
                    }`}
                  >
                    {subscribingPlanId === plan.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : isCurrent ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Current Plan Active
                      </>
                    ) : (
                      <>
                        <span>{activeSubscription ? 'Switch to This Plan' : 'Switch to This Plan'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto border-t border-[var(--theme-border)] pt-12">
          <h3 className="text-xl font-bold mb-6 text-center">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)]">
              <h4 className="font-semibold text-sm mb-1">When does my free delivery benefit apply?</h4>
              <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                Immediately upon confirmed payment. Your cart will automatically reflect ₹0 delivery fee on any item, with no minimum ₹1,499 cart subtotal required.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)]">
              <h4 className="font-semibold text-sm mb-1">Will I be charged recurring monthly subscriptions?</h4>
              <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                No. VARNYXA Privé is a transparent, one-time payment for the chosen duration. You can manually renew or switch plans whenever you desire.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--theme-surface)] border border-[var(--theme-border)]">
              <h4 className="font-semibold text-sm mb-1">Can I use PayYantra to complete payment?</h4>
              <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                Yes. Subscription orders are processed via our verified PayYantra payment gateway with high-security UPI, Card, and NetBanking options.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
