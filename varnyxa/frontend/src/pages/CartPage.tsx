import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Tag, ShieldCheck, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatters';

export const CartPage: React.FC = () => {
  const { cart, updateQuantity, removeItem, applyCoupon, loading } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const navigate = useNavigate();

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setIsApplying(true);
    try {
      await applyCoupon(couponCode.trim());
      setCouponCode('');
    } catch {
      // Handled in toast
    } finally {
      setIsApplying(false);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-5">
        <div className="w-20 h-20 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-full flex items-center justify-center mx-auto text-[var(--theme-text-muted)] shadow-sm">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="font-serif text-3xl font-extrabold text-[var(--theme-text)]">Your Shopping Bag is Empty</h1>
        <p className="text-xs text-[var(--theme-text-muted)] max-w-sm mx-auto">
          Explore our inclusive fashion collections and elevate your wardrobe with authentic tailoring.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition shadow-xl"
        >
          <span>Discover Editions</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const shippingThreshold = cart.shipping_threshold || 1499;
  const isFreeDelivery = cart.is_free_shipping || cart.shipping_fee === 0;
  const amountToFreeDelivery = Math.max(0, shippingThreshold - cart.subtotal);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-10">
      <div className="pb-3 sm:pb-4 border-b border-[var(--theme-border)]">
        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--theme-text)]">
          Shopping Bag ({cart.item_count})
        </h1>
        <p className="text-xs text-[var(--theme-text-muted)] mt-1">Review your selected garments and verify tailoring details</p>
      </div>

      {/* Free Delivery Status Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
        isFreeDelivery
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
          : 'bg-[var(--theme-primary)]/10 border-[var(--theme-primary)]/20 text-[var(--theme-text)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <Truck className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
          <span>
            {isFreeDelivery ? (
              <strong>🎉 You have qualified for FREE Express Delivery!</strong>
            ) : (
              <>
                Add <strong className="font-bold text-[var(--theme-primary)]">{formatPrice(amountToFreeDelivery)}</strong> more to unlock <strong>FREE Delivery</strong> (on orders ₹{shippingThreshold.toLocaleString('en-IN')}+)
              </>
            )}
          </span>
        </div>
        {!isFreeDelivery && (
          <Link
            to="/shop"
            className="text-[var(--theme-primary)] font-bold text-xs hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            Shop More <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 sm:p-5 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] flex flex-row items-start gap-3 sm:gap-5 shadow-sm"
            >
              {/* Thumbnail */}
              <div className="w-20 h-28 sm:w-24 sm:h-32 bg-[var(--theme-bg)] rounded-xl sm:rounded-2xl overflow-hidden shrink-0 border border-[var(--theme-border)]">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.product_title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[var(--theme-text-muted)]">VARNYXA</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 flex flex-col justify-between w-full h-full space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Link to={`/product/${item.product_slug}`} className="hover:text-[var(--theme-primary)] transition">
                      <h3 className="font-semibold text-sm text-[var(--theme-text)] leading-snug">{item.product_title}</h3>
                    </Link>
                    <p className="text-[11px] text-[var(--theme-text-muted)] font-mono mt-0.5">SKU: {item.sku}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--theme-text-muted)]">
                      <span className="px-2 py-0.5 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-md font-medium text-[var(--theme-text)]">
                        Size: {item.size}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium text-[var(--theme-text)]">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: item.color_hex }}
                        />
                        {item.color_name}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-[var(--theme-text-muted)] hover:text-red-500 transition"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--theme-border)]/50">
                  {/* Stepper */}
                  <div className="flex items-center border border-[var(--theme-border)] rounded-xl bg-[var(--theme-bg)] overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      disabled={item.quantity <= 1 || loading}
                      className="p-1 px-3 text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface)] disabled:opacity-30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-[var(--theme-text)]">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock_quantity || loading}
                      className="p-1 px-3 text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface)] disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-[var(--theme-text)]">
                      {formatPrice(item.total_price)}
                    </span>
                    <span className="block text-[10px] text-[var(--theme-text-muted)]">
                      ({formatPrice(item.unit_price)} each)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Column */}
        <div className="space-y-4 sm:space-y-6">
          <div className="p-4 sm:p-6 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] shadow-md space-y-4 sm:space-y-5">
            <h3 className="font-serif text-base sm:text-lg font-bold text-[var(--theme-text)] uppercase tracking-wider">
              Order Summary
            </h3>

            {/* Coupon Box */}
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-[var(--theme-text-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Coupon (e.g. WELCOME500)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl uppercase font-medium focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isApplying || !couponCode.trim()}
                className="px-4 py-2 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-40 uppercase tracking-wider transition"
              >
                Apply
              </button>
            </form>

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs text-[var(--theme-text-muted)] pt-3 border-t border-[var(--theme-border)]">
              <div className="flex justify-between text-[var(--theme-text)]">
                <span>Merchandise Subtotal</span>
                <span className="font-bold">{formatPrice(cart.subtotal)}</span>
              </div>

              {cart.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Applied Discount ({cart.coupon_code || 'PROMO'})</span>
                  <span>-{formatPrice(cart.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Delivery Charges</span>
                <span>
                  {isFreeDelivery ? (
                    <strong className="text-emerald-600 dark:text-emerald-400 uppercase text-[11px]">Free Express</strong>
                  ) : (
                    <strong className="text-[var(--theme-text)]">{formatPrice(cart.shipping_fee)}</strong>
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Integrated GST ({cart.tax_rate ?? 18}%)</span>
                <span className="text-[var(--theme-text)]">{formatPrice(cart.tax_amount)}</span>
              </div>

              <div className="flex justify-between text-base font-extrabold text-[var(--theme-text)] pt-3 border-t border-[var(--theme-border)]">
                <span>Total Amount</span>
                <span className="text-[var(--theme-primary)]">{formatPrice(cart.total_amount)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full py-4 bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] text-xs font-bold uppercase tracking-[0.2em] rounded-xl hover:opacity-90 transition shadow-xl flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="p-4 bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)] flex items-center gap-3 text-xs text-[var(--theme-text-muted)]">
            <ShieldCheck className="w-5 h-5 text-[var(--theme-primary)] shrink-0" />
            <span>Guaranteed 256-bit encrypted checkout with instant UPI & card protection.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
