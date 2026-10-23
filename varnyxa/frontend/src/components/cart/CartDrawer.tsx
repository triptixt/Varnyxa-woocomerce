import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../utils/formatters';

export const CartDrawer: React.FC = () => {
  const { cart, isCartOpen, closeCart, updateQuantity, removeItem, applyCoupon, loading } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const handleCouponApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setIsApplyingCoupon(true);
    try {
      await applyCoupon(couponInput.trim());
      setCouponInput('');
    } catch {
      // Handled in context toast
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCheckoutClick = () => {
    closeCart();
    navigate('/checkout');
  };

  const freeShippingThreshold = 1499;
  const currentSubtotal = cart?.subtotal || 0;
  const amountNeededForFreeShipping = Math.max(0, freeShippingThreshold - currentSubtotal);
  const progressPercent = Math.min(100, (currentSubtotal / freeShippingThreshold) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 w-full sm:w-auto">
        <div
          className="w-full sm:w-screen sm:max-w-md shadow-2xl flex flex-col justify-between border-l transition-colors duration-300"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* Header */}
          <div
            className="p-4 sm:p-6 border-b flex items-center justify-between transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <ShoppingBag className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
              <h3
                className="font-serif text-base sm:text-lg font-bold tracking-wider uppercase"
                style={{ color: 'var(--text-primary)' }}
              >
                Shopping Bag ({cart?.item_count || 0})
              </h3>
            </div>
            <button
              onClick={closeCart}
              className="p-2 rounded-full hover:bg-black/5 transition cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div
            className="px-4 sm:px-6 py-2.5 sm:py-3 border-b transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface-alt)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {amountNeededForFreeShipping === 0 ? (
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--accent-primary)' }}>
                  <Sparkles className="w-3.5 h-3.5" /> You qualify for Complimentary Express Delivery!
                </span>
              ) : (
                <span>
                  Add <strong>{formatPrice(amountNeededForFreeShipping)}</strong> more for Free Express Delivery
                </span>
              )}
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {!cart || cart.items.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--bg-surface-alt)', color: 'var(--text-muted)' }}
                >
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-serif text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Your shopping bag is empty
                  </h4>
                  <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
                    Explore our curated editions of timeless tailoring, linen essentials, and heritage couture.
                  </p>
                </div>
                <button
                  onClick={() => {
                    closeCart();
                    navigate('/shop');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  Explore Editions <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 sm:gap-4 pb-4 sm:pb-6 border-b last:border-b-0"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {/* Thumbnail */}
                  <div
                    className="w-16 h-22 sm:w-20 sm:h-26 rounded-xl overflow-hidden shrink-0 border"
                    style={{
                      backgroundColor: 'var(--bg-surface-alt)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_title}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        Garment
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs sm:text-sm font-semibold leading-snug line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                          {item.product_title}
                        </h4>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 transition cursor-pointer shrink-0 hover:text-red-500"
                          style={{ color: 'var(--text-muted)' }}
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-[11px] sm:text-xs flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: 'var(--bg-surface-alt)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          Size: {item.size}
                        </span>
                        <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/20"
                            style={{ backgroundColor: item.color_hex }}
                          />
                          {item.color_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 sm:mt-3">
                      {/* Quantity Stepper */}
                      <div
                        className="flex items-center border rounded-lg overflow-hidden"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1 || loading}
                          className="p-1 px-2 disabled:opacity-30 transition cursor-pointer hover:opacity-70"
                          style={{ color: 'var(--text-primary)' }}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock_quantity || loading}
                          className="p-1 px-2 disabled:opacity-30 transition cursor-pointer hover:opacity-70"
                          style={{ color: 'var(--text-primary)' }}
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {formatPrice(item.total_price)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Calculations */}
          {cart && cart.items.length > 0 && (
            <div
              className="p-4 sm:p-6 border-t space-y-3 sm:space-y-4 pb-safe transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              {/* Coupon Form */}
              <form onSubmit={handleCouponApply} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-2.5" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Coupon code (e.g. WELCOME500)"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="w-full pl-8 sm:pl-9 pr-3 py-2 text-xs border rounded-xl focus:outline-none uppercase"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isApplyingCoupon || !couponInput.trim()}
                  className="px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl disabled:opacity-40 transition uppercase cursor-pointer"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  {isApplyingCoupon ? '...' : 'Apply'}
                </button>
              </form>

              {/* Breakdown */}
              <div className="space-y-1 sm:space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatPrice(cart.subtotal)}</span>
                </div>

                {cart.discount_amount > 0 && (
                  <div className="flex justify-between font-semibold" style={{ color: 'var(--accent-primary)' }}>
                    <span>Discount ({cart.coupon_code})</span>
                    <span>-{formatPrice(cart.discount_amount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Standard Shipping</span>
                  <span>{cart.shipping_fee === 0 ? <strong className="uppercase text-[11px]" style={{ color: 'var(--accent-primary)' }}>Free</strong> : formatPrice(cart.shipping_fee)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Estimated GST (12%)</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatPrice(cart.tax_amount)}</span>
                </div>

                <div
                  className="flex justify-between text-sm font-bold pt-2 border-t"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <span>Total Amount</span>
                  <span className="text-base">{formatPrice(cart.total_amount)}</span>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                onClick={handleCheckoutClick}
                className="w-full py-3.5 text-xs font-bold uppercase tracking-[0.15em] rounded-xl transition shadow-xl flex items-center justify-center gap-2 group cursor-pointer"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
