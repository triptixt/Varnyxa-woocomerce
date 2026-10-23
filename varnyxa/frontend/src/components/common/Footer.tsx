import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, RefreshCw, Truck, Award, ArrowUpRight, Loader2, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { success, error } = useToast();

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      error('Please enter a valid email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      error('Please enter a valid email address format.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.newsletter.subscribe({
        email: email.trim(),
        consent: true,
        source: 'footer',
      });
      setIsSubscribed(true);
      success(res.message || 'Welcome to the VARNYXA Club!');
      setEmail('');
    } catch (err: any) {
      error(err.message || 'Could not complete subscription. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-[#121212] text-[#FAF9F6] border-t border-[#262626] pt-10 sm:pt-16 pb-8 sm:pb-12 mt-12 sm:mt-20 pb-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Core Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 pb-8 sm:pb-14 border-b border-[#262626]">
          <div className="flex items-start gap-3.5">
            <Truck className="w-5 h-5 text-[#C5A880] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold tracking-wider uppercase text-[#FAF9F6]">Pan-India Express</h4>
              <p className="text-[12px] text-[#8C887B] mt-0.5">Free delivery on orders over ₹1,499</p>
            </div>
          </div>
          <div className="flex items-start gap-3.5">
            <RefreshCw className="w-5 h-5 text-[#C5A880] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold tracking-wider uppercase text-[#FAF9F6]">7-Day Returns</h4>
              <p className="text-[12px] text-[#8C887B] mt-0.5">Hassle-free doorstep exchanges</p>
            </div>
          </div>
          <div className="flex items-start gap-3.5">
            <Shield className="w-5 h-5 text-[#C5A880] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold tracking-wider uppercase text-[#FAF9F6]">Secure Online Checkout</h4>
              <p className="text-[12px] text-[#8C887B] mt-0.5">256-bit encrypted checkout</p>
            </div>
          </div>
          <div className="flex items-start gap-3.5">
            <Award className="w-5 h-5 text-[#C5A880] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold tracking-wider uppercase text-[#FAF9F6]">Curated Artisanship</h4>
              <p className="text-[12px] text-[#8C887B] mt-0.5">Authentic handlooms & tailoring</p>
            </div>
          </div>
        </div>

        {/* Links Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 py-8 sm:py-12">
          {/* Brand Col */}
          <div className="sm:col-span-2 lg:col-span-2 space-y-4">
            <span className="font-serif text-3xl font-bold tracking-[0.2em] text-[#FAF9F6] block">
              VARNYXA
            </span>
            <p className="text-xs leading-relaxed text-[#A09D94] max-w-sm">
              Contemporary haute couture and inclusive fashion designed with uncompromising precision. From artisanal handlooms to modern architectural tailoring for men, women, unisex, kids, and babies.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#C5A880] block mb-2">
                Newsletter Dispatch
              </span>
              {isSubscribed ? (
                <div className="flex items-center gap-2 p-2.5 bg-[#1C1C1E] border border-emerald-500/30 rounded-xl max-w-sm text-xs text-emerald-400">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Subscribed to VARNYXA Club. Thank you!</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex max-w-sm">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    placeholder="Enter your email"
                    className="w-full bg-[#1C1C1E] border border-[#333333] px-3.5 py-2 text-xs text-white placeholder-[#666] rounded-l-xl focus:outline-none focus:border-[#C5A880]"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#C5A880] text-[#121212] px-4 py-2 text-xs font-bold rounded-r-xl uppercase tracking-wider hover:bg-[#D4AF37] disabled:opacity-50 transition flex items-center gap-1.5 shrink-0"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Join'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#C5A880]">Editions</h5>
            <ul className="space-y-2 text-xs text-[#A09D94]">
              <li><Link to="/shop?gender=men" className="hover:text-white transition">Men's Tailoring</Link></li>
              <li><Link to="/shop?gender=women" className="hover:text-white transition">Women's Collection</Link></li>
              <li><Link to="/shop?gender=unisex" className="hover:text-white transition">Unisex Silhouettes</Link></li>
              <li><Link to="/shop?category=kids-baby-wear" className="hover:text-white transition">Kids & Baby Wear</Link></li>
              <li><Link to="/shop?category=ethnic-festive" className="hover:text-white transition">Heritage & Sarees</Link></li>
              <li><Link to="/shop?category=outerwear-coats" className="hover:text-white transition">Coats & Trench</Link></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#C5A880]">Client Care</h5>
            <ul className="space-y-2 text-xs text-[#A09D94]">
              <li><Link to="/account?tab=orders" className="hover:text-white transition">Track Your Order</Link></li>
              <li><Link to="/account?tab=addresses" className="hover:text-white transition">Saved Addresses</Link></li>
              <li><Link to="/account?tab=wishlist" className="hover:text-white transition">My Wishlist</Link></li>
              <li><span className="cursor-pointer hover:text-white transition">Shipping Policy</span></li>
              <li><span className="cursor-pointer hover:text-white transition">Returns & Exchanges</span></li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#C5A880]">Transparency</h5>
            <ul className="space-y-2 text-xs text-[#A09D94]">
              <li><span className="cursor-pointer hover:text-white transition">Privacy Policy</span></li>
              <li><span className="cursor-pointer hover:text-white transition">Terms of Service</span></li>
              <li><span className="cursor-pointer hover:text-white transition">Authenticity Guarantee</span></li>
              <li><span className="cursor-pointer hover:text-white transition">Artisan Ethical Sourcing</span></li>
              <li>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#C5A880] hover:underline"
                >
                  FastAPI Swagger <ArrowUpRight className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#262626] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6E6B64]">
          <p>© {new Date().getFullYear()} VARNYXA FASHION PRIVATE LIMITED. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px] tracking-wider uppercase">
            <span>Made in India</span>
            <span>•</span>
            <span>INR (₹) Currency</span>
            <span>•</span>
            <span>Verified Secure Store</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
