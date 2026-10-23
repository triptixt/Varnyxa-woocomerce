import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, ShoppingBag, Eye } from 'lucide-react';
import { ProductListItem } from '../../types';
import { formatPrice } from '../../utils/formatters';
import { useWishlist } from '../../context/WishlistContext';
import { QuickViewModal } from './QuickViewModal';

interface ProductCardProps {
  product: ProductListItem;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, index = 0 }) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [isQuickViewOpen, setIsQuickViewOpen] = useState<boolean>(false);
  const [isHeartPopping, setIsHeartPopping] = useState<boolean>(false);
  const inWishlist = isInWishlist(product.id);

  const effectivePrice = product.sale_price !== null && product.sale_price !== undefined ? product.sale_price : product.base_price;
  const hasDiscount = product.sale_price !== null && product.sale_price !== undefined && product.discount_percent > 0;
  const isSoldOut = product.total_stock <= 0;

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHeartPopping(true);
    setTimeout(() => setIsHeartPopping(false), 500);
    toggleWishlist(product.id);
  };

  return (
    <>
      <div
        className="group relative flex flex-col rounded-2xl overflow-hidden border shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-card-entrance"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          animationDelay: `${Math.min(index * 60, 600)}ms`,
        }}
      >
        {/* Image Container with Hover Overlay Actions */}
        <div className="relative aspect-[3/4] overflow-hidden bg-black/5 block">
          <Link to={`/product/${product.slug}`} className="block w-full h-full">
            {product.primary_image_url ? (
              <img
                src={product.primary_image_url}
                alt={product.title}
                loading="lazy"
                className="w-full h-full object-cover object-center group-hover:scale-106 transition-transform duration-700 ease-out"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=1000&q=80';
                }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xs font-serif italic"
                style={{ color: 'var(--text-muted)' }}
              >
                VARNYXA Atelier
              </div>
            )}
          </Link>

          {/* Badges on Top Left */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1 z-10 pointer-events-none">
            {product.is_featured && (
              <span className="bg-[#121212]/90 backdrop-blur-md text-[#FAF9F6] text-[8px] sm:text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-sm">
                Featured
              </span>
            )}
            {hasDiscount && (
              <span className="bg-[#C5A880] text-[#121212] text-[8px] sm:text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-sm">
                {product.discount_percent}% Off
              </span>
            )}
          </div>

          {/* Quick Action Floating Bar on Hover (Desktop only) */}
          <div className="hidden md:flex absolute inset-x-3 bottom-3 z-10 items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <button
              onClick={() => setIsQuickViewOpen(true)}
              className="flex-1 py-2.5 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--text-primary)' }}
              title="Quick Add to Cart"
            >
              <ShoppingBag className="w-3.5 h-3.5" style={{ color: 'var(--bg-primary)' }} />
              <span style={{ color: 'var(--bg-primary)' }}>{isSoldOut ? 'Sold Out' : 'Quick Add'}</span>
            </button>
            <button
              onClick={() => setIsQuickViewOpen(true)}
              className="p-2.5 backdrop-blur-md rounded-xl transition shadow-lg cursor-pointer border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              title="Quick View multiple photos"
              aria-label="Quick View"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Stock Notice Overlay if Low */}
          {product.total_stock <= 3 && product.total_stock > 0 && (
            <div className="absolute top-2 right-10 sm:top-3 sm:right-12 text-center bg-[#121212]/80 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 sm:px-2 rounded-md pointer-events-none">
              Only {product.total_stock} left
            </div>
          )}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
              <span className="bg-[#121212] text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2.5 py-1 sm:px-4 sm:py-2 rounded-xl">
                Sold Out
              </span>
            </div>
          )}

          {/* Wishlist Button on Top Right with Heart Pop animation */}
          <button
            onClick={handleWishlistClick}
            className={`absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-all shadow-md z-20 cursor-pointer ${
              isHeartPopping ? 'animate-heart-pop' : 'hover:scale-110 active:scale-95'
            }`}
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: inWishlist ? '#D9534F' : 'var(--text-primary)',
            }}
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                inWishlist ? "fill-[#D9534F] text-[#D9534F]" : ""
              }`}
            />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          <div>
            {/* Brand & Category */}
            <div className="flex items-center justify-between text-[9px] sm:text-[11px] uppercase tracking-wider mb-1">
              <span className="truncate max-w-[65%]" style={{ color: 'var(--text-muted)' }}>
                {product.brand_name || 'VARNYXA'}
              </span>
              <span
                className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded capitalize shrink-0"
                style={{
                  backgroundColor: 'var(--bg-surface-alt)',
                  color: 'var(--text-primary)',
                }}
              >
                {product.gender}
              </span>
            </div>

            {/* Title */}
            <Link to={`/product/${product.slug}`} className="block transition-colors hover:underline">
              <h3
                className="text-xs sm:text-sm font-semibold line-clamp-1 leading-snug"
                style={{ color: 'var(--text-primary)' }}
              >
                {product.title}
              </h3>
            </Link>
          </div>

          <div>
            <div
              className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t flex items-center justify-between gap-1"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {/* Pricing */}
              <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                <span className="text-xs sm:text-sm md:text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatPrice(effectivePrice)}
                </span>
                {hasDiscount && (
                  <span className="text-[10px] sm:text-xs line-through" style={{ color: 'var(--text-muted)' }}>
                    {formatPrice(product.base_price)}
                  </span>
                )}
              </div>

              {/* Rating */}
              {product.rating_average > 0 ? (
                <div
                  className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] font-semibold shrink-0"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#C5A880] text-[#C5A880]" />
                  <span>{product.rating_average.toFixed(1)}</span>
                </div>
              ) : (
                <span
                  className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider hidden xs:inline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Authentic
                </span>
              )}
            </div>

            {/* Available Sizes preview */}
            {product.available_sizes && product.available_sizes.length > 0 && (
              <div className="mt-1.5 sm:mt-2.5 flex items-center gap-1 text-[9px] sm:text-[10px] overflow-hidden whitespace-nowrap">
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Sizes:</span>
                {product.available_sizes.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="px-1 py-0.5 rounded font-mono text-[9px]"
                    style={{
                      backgroundColor: 'var(--bg-surface-alt)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {s}
                  </span>
                ))}
                {product.available_sizes.length > 3 && (
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    +{product.available_sizes.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Direct Add to Cart Action Button */}
            <button
              onClick={() => setIsQuickViewOpen(true)}
              disabled={isSoldOut}
              className={`w-full mt-2.5 sm:mt-3.5 py-2 sm:py-2.5 px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 ${
                isSoldOut ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
              }}
            >
              <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">{isSoldOut ? 'Sold Out' : 'Add to Bag'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick View & Size Select Modal */}
      <QuickViewModal
        productId={isQuickViewOpen ? product.id : null}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
      />
    </>
  );
};
