import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, Compass, Feather, Award } from 'lucide-react';
import { ProductListItem } from '../types';
import { api } from '../services/api';
import { ProductCard } from '../components/product/ProductCard';
import { NewsletterSection } from '../components/common/NewsletterSection';

export const HomePage: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<ProductListItem[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [featured, newest] = await Promise.all([
          api.products.getFeatured(4),
          api.products.getNewArrivals(4),
        ]);
        setFeaturedProducts(featured);
        setNewArrivals(newest);
      } catch (err) {
        console.error('Error fetching home data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHomeData();
  }, []);

  const editorialCategories = [
    {
      title: "Artisanal Heritage & Silk",
      subtitle: "Handloom Sarees & Bandhgalas",
      image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
      link: "/shop?category=ethnic-festive",
    },
    {
      title: "Tailored Wool & Outerwear",
      subtitle: "Camel Coats & Cashmere",
      image: "https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=800&q=80",
      link: "/shop?category=outerwear-coats",
    },
    {
      title: "Breathable French Linen",
      subtitle: "Relaxed Camp Collars & Tunics",
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
      link: "/shop?category=shirts-tops",
    },
    {
      title: "Gentle Juniors & Babywear",
      subtitle: "Hypoallergenic Organic Bamboo",
      image: "https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=800&q=80",
      link: "/shop?category=kids-baby-wear",
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-20 lg:space-y-28">
      {/* Hero Editorial Section */}
      <section className="relative min-h-[75vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden bg-[#121212]">
        {/* Background Image with elegant gradient overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=2000&q=85"
            alt="VARNYXA Haute Couture Editorial Background"
            className="w-full h-full object-cover object-center opacity-45 scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-[#121212]/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white py-14 sm:py-24 space-y-5 sm:space-y-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#C5A880]">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Inclusive Haute Couture 2026
          </div>

          <h1 className="font-serif text-2xl xs:text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.15] sm:leading-[1.1] max-w-4xl mx-auto">
            Elegance Without Boundaries. Tailored for Every Generation.
          </h1>

          <p className="text-xs sm:text-base md:text-lg text-[#D1CEC7] max-w-2xl mx-auto font-light leading-relaxed">
            Discover a curated universe of contemporary silhouettes, heritage handlooms, and timeless organic essentials crafted for men, women, unisex, kids, and babies.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4 w-full">
            <Link
              to="/shop"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-[#FAF9F6] text-[#121212] text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] rounded-xl hover:bg-[#C5A880] hover:text-[#121212] transition-all shadow-2xl flex items-center justify-center gap-2 group"
            >
              <span>Explore The Catalog</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/shop?category=ethnic-festive"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-white/10 backdrop-blur-md border border-white/20 text-[#FAF9F6] text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] rounded-xl hover:bg-white/20 transition-all flex items-center justify-center"
            >
              Heritage Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Brand Craftsmanship Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 p-5 sm:p-8 bg-[var(--theme-surface)] rounded-2xl sm:rounded-3xl border border-[var(--theme-border)] shadow-sm">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-[var(--theme-text)]" />
            </div>
            <div>
              <h4 className="font-serif text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider">Inclusive Design</h4>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 sm:mt-1 leading-relaxed">Silhouettes calibrated for newborns, kids, teens, adults, and seniors.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center shrink-0">
              <Feather className="w-5 h-5 text-[var(--theme-text)]" />
            </div>
            <div>
              <h4 className="font-serif text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider">Rare Natural Fibers</h4>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 sm:mt-1 leading-relaxed">Mongolian Cashmere, Mulberry Silk, French Flax, and Okayama Denim.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-[var(--theme-text)]" />
            </div>
            <div>
              <h4 className="font-serif text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider">Verified Authenticity</h4>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 sm:mt-1 leading-relaxed">Real inventory backed directly by PostgreSQL transactional integrity.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[var(--theme-text)]" />
            </div>
            <div>
              <h4 className="font-serif text-sm font-bold text-[var(--theme-text)] uppercase tracking-wider">Secure Payment Gateway</h4>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 sm:mt-1 leading-relaxed">Instant UPI QR, Credit/Debit cards & NetBanking with PCI-DSS 256-bit encryption.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Category Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2 sm:space-y-3 mb-8 sm:mb-12">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--theme-primary)]">The Curated Showcase</span>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--theme-text)]">
            Signature Categories
          </h2>
          <div className="w-12 h-0.5 bg-[var(--theme-primary)] mx-auto mt-2" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {editorialCategories.map((cat) => (
            <Link
              key={cat.title}
              to={cat.link}
              className="group relative aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden block shadow-md hover:shadow-2xl transition-all duration-500"
            >
              <img
                src={cat.image}
                alt={cat.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5 sm:p-6 text-white">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-[#C5A880] mb-1">
                  {cat.subtitle}
                </span>
                <h3 className="font-serif text-base sm:text-lg font-bold leading-tight group-hover:text-[#C5A880] transition-colors">
                  {cat.title}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold mt-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  View Collection <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Section (Real DB) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between mb-6 sm:mb-10 pb-3 sm:pb-4 border-b border-[var(--theme-border)] gap-2">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--theme-primary)]">Handpicked Couture</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[var(--theme-text)] mt-0.5 sm:mt-1">
              Featured Creations
            </h2>
          </div>
          <Link
            to="/shop?is_featured=true"
            className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)] hover:text-[var(--theme-primary)] flex items-center gap-1.5 transition"
          >
            <span>View All Featured</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse border border-[#E8E6E1]" />
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="p-8 sm:p-12 text-center bg-white rounded-2xl border border-[#E8E6E1]">
            <p className="text-xs text-[#8C887B]">No featured garments available yet.</p>
          </div>
        )}
      </section>

      {/* Editorial Quote & Heritage Highlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1C1C1E] text-white p-6 sm:p-10 md:p-16 flex flex-col md:flex-row items-center gap-6 sm:gap-10">
          <div className="flex-1 space-y-3 sm:space-y-5">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-[#C5A880]">The VARNYXA Philosophy</span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
              Honoring Heritage. Redefining Modernity.
            </h2>
            <p className="text-xs sm:text-sm text-[#D1CEC7] font-light leading-relaxed">
              We bridge traditional Indian handloom traditions with clean Scandinavian minimalism. Every stitch is placed with intention, ensuring garments that gracefully endure across seasons and generations.
            </p>
            <div className="pt-2">
              <Link
                to="/shop?category=ethnic-festive"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-[#C5A880] text-[#121212] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#D4AF37] transition"
              >
                Explore Artisanal Handlooms <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="w-full md:w-72 lg:w-80 aspect-[4/5] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shrink-0">
            <img
              src="https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80"
              alt="Artisan Silk Weaving Motif"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* New Arrivals Section (Real DB) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between mb-6 sm:mb-10 pb-3 sm:pb-4 border-b border-[var(--theme-border)] gap-2">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--theme-primary)]">Fresh Off The Looms</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[var(--theme-text)] mt-0.5 sm:mt-1">
              New Season Arrivals
            </h2>
          </div>
          <Link
            to="/shop?sort=newest"
            className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)] hover:text-[var(--theme-primary)] flex items-center gap-1.5 transition"
          >
            <span>View All New Arrivals</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] bg-[var(--theme-surface)] rounded-2xl animate-pulse border border-[var(--theme-border)]" />
            ))}
          </div>
        ) : newArrivals.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {newArrivals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="p-8 sm:p-12 text-center bg-[var(--theme-surface)] rounded-2xl border border-[var(--theme-border)]">
            <p className="text-xs text-[var(--theme-text-muted)]">No new arrivals yet.</p>
          </div>
        )}
      </section>

      {/* Join the VARNYXA Club Newsletter Section */}
      <NewsletterSection source="homepage" />
    </div>
  );
};
