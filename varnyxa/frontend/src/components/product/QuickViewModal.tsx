import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Heart, Star, ShoppingBag, ArrowRight, Check, ChevronLeft, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';
import { ProductDetail, ProductVariant } from '../../types';
import { api } from '../../services/api';
import { formatPrice } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';

interface QuickViewModalProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ productId, isOpen, onClose }) => {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { success, error } = useToast();

  useEffect(() => {
    if (!productId || !isOpen) {
      setProduct(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadProduct = async () => {
      try {
        const data = await api.products.getById(productId);
        if (isMounted) {
          setProduct(data);
          const primaryImg = data.images.find((i) => i.is_primary) || data.images[0];
          if (primaryImg) {
            setSelectedImage(primaryImg.image_url);
            setCurrentImageIndex(data.images.findIndex((i) => i.id === primaryImg.id) || 0);
          }

          // Pre-select first available variant
          const firstInStock = data.variants.find((v) => v.stock_quantity > 0) || data.variants[0];
          if (firstInStock) {
            setSelectedSize(firstInStock.size);
            setSelectedColor(firstInStock.color_name);
          }
        }
      } catch (err: any) {
        console.error('Error loading quick view product:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchedVariant: ProductVariant | undefined = product?.variants.find(
    (v) => v.size === selectedSize && v.color_name === selectedColor
  ) || product?.variants.find((v) => v.size === selectedSize) || product?.variants[0];

  const effectivePrice = matchedVariant?.price_override ?? (product?.sale_price || product?.base_price || 0);
  const currentStock = matchedVariant?.stock_quantity ?? 0;
  const isOutOfStock = currentStock <= 0;

  const allSizes = Array.from(new Set(product?.variants.map((v) => v.size) || []));
  const allColors = Array.from(
    new Map(product?.variants.map((v) => [v.color_name, { name: v.color_name, hex: v.color_hex }]) || []).values()
  );

  const inWishlist = product ? isInWishlist(product.id) : false;

  const handleNextImage = () => {
    if (!product || product.images.length <= 1) return;
    const nextIdx = (currentImageIndex + 1) % product.images.length;
    setCurrentImageIndex(nextIdx);
    setSelectedImage(product.images[nextIdx].image_url);
  };

  const handlePrevImage = () => {
    if (!product || product.images.length <= 1) return;
    const prevIdx = (currentImageIndex - 1 + product.images.length) % product.images.length;
    setCurrentImageIndex(prevIdx);
    setSelectedImage(product.images[prevIdx].image_url);
  };

  const handleAddToCart = async () => {
    if (!matchedVariant) {
      error('Please select an available garment size.');
      return;
    }
    if (isOutOfStock) {
      error('Selected garment variant is currently out of stock.');
      return;
    }

    setIsAdding(true);
    try {
      await addToCart(matchedVariant.id, quantity);
      onClose();
    } catch (err: any) {
      // Toast handles error message
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#121212]/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-[#E8E6E1] z-10 my-auto sm:my-8 max-h-[92vh] sm:max-h-[88vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-full bg-white/90 backdrop-blur-md text-[#121212] hover:bg-[#121212] hover:text-white transition z-20 shadow-md cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 sm:p-8 gap-6 sm:gap-8 animate-pulse">
            <div className="aspect-[3/4] bg-[#F5F3EF] rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-[#F5F3EF] rounded-lg w-1/3" />
              <div className="h-8 bg-[#F5F3EF] rounded-lg w-3/4" />
              <div className="h-6 bg-[#F5F3EF] rounded-lg w-1/4" />
              <div className="h-20 bg-[#F5F3EF] rounded-xl" />
              <div className="h-12 bg-[#F5F3EF] rounded-xl" />
            </div>
          </div>
        ) : product ? (
          <div className="grid grid-cols-1 md:grid-cols-2 overflow-y-auto">
            {/* Gallery Column */}
            <div className="p-4 sm:p-8 bg-[#FAF9F6] border-b md:border-b-0 md:border-r border-[#E8E6E1] flex flex-col justify-between">
              {/* Main Image with Navigation Arrows */}
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white border border-[#E8E6E1] shadow-sm">
                <img
                  src={selectedImage || product.images[0]?.image_url}
                  alt={product.title}
                  className="w-full h-full object-cover object-center transition-all duration-300"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=1000&q=80';
                  }}
                />

                {/* Discount Badge */}
                {product.discount_percent > 0 && (
                  <span className="absolute top-3 left-3 bg-[#C5A880] text-[#121212] text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
                    {product.discount_percent}% Off
                  </span>
                )}

                {/* Next / Prev Image Controls */}
                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 text-[#121212] hover:bg-white shadow-md transition"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 text-[#121212] hover:bg-white shadow-md transition"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Image counter indicator */}
                {product.images.length > 1 && (
                  <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                    {currentImageIndex + 1} / {product.images.length}
                  </div>
                )}
              </div>

              {/* Thumbnails Strip */}
              {product.images.length > 1 && (
                <div className="flex items-center gap-2.5 mt-4 overflow-x-auto pb-1">
                  {product.images.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      onClick={() => {
                        setSelectedImage(img.image_url);
                        setCurrentImageIndex(idx);
                      }}
                      className={`w-14 h-18 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                        selectedImage === img.image_url
                          ? 'border-[#121212] shadow-sm scale-95'
                          : 'border-[#E8E6E1] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.image_url} alt={img.alt_text} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details & Purchase Actions */}
            <div className="p-4 sm:p-8 flex flex-col justify-between space-y-4 sm:space-y-6">
              <div>
                {/* Brand & Category */}
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#8C887B] mb-1">
                  <span className="font-semibold text-[#121212]">{product.brand?.name || 'VARNYXA'}</span>
                  <span className="bg-[#F5F3EF] px-2 py-0.5 rounded capitalize font-medium">
                    {product.gender} • {product.category.name}
                  </span>
                </div>

                {/* Title */}
                <h2 className="font-serif text-2xl font-bold text-[#121212] leading-snug">
                  {product.title}
                </h2>

                {/* Ratings & SKU */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex items-center gap-1 text-[#C5A880]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= Math.round(product.rating_average || 5)
                            ? 'fill-[#C5A880] text-[#C5A880]'
                            : 'text-[#E8E6E1]'
                        }`}
                      />
                    ))}
                    <span className="text-[#121212] font-bold ml-1">
                      {product.rating_average ? product.rating_average.toFixed(1) : '5.0'}
                    </span>
                  </div>
                  <span className="text-[#8C887B]">|</span>
                  <span className="text-[#8C887B] font-mono text-[11px]">SKU: {matchedVariant?.sku || product.sku_prefix}</span>
                </div>

                {/* Pricing */}
                <div className="flex items-baseline gap-3 mt-4">
                  <span className="text-2xl font-extrabold text-[#121212]">
                    {formatPrice(effectivePrice)}
                  </span>
                  {product.sale_price && product.base_price > product.sale_price && (
                    <span className="text-sm text-[#8C887B] line-through">
                      {formatPrice(product.base_price)}
                    </span>
                  )}
                  <span className="text-[11px] text-[#6E6B64] font-medium">Inclusive of all taxes</span>
                </div>

                {/* Fabric & Fit badge */}
                {(product.fabric || product.fit) && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#F0EFEA] text-[11px]">
                    {product.fabric && (
                      <span className="px-2.5 py-1 bg-[#F5F3EF] text-[#4A4A4A] rounded-lg">
                        <strong>Fabric:</strong> {product.fabric}
                      </span>
                    )}
                    {product.fit && (
                      <span className="px-2.5 py-1 bg-[#F5F3EF] text-[#4A4A4A] rounded-lg">
                        <strong>Fit:</strong> {product.fit}
                      </span>
                    )}
                  </div>
                )}

                {/* Size Selection */}
                {allSizes.length > 0 && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#121212] mb-2">
                      <span>Select Size:</span>
                      <span className="text-[#8C887B] font-normal">Available in {allSizes.length} sizes</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allSizes.map((sz) => {
                        const variantForSize = product.variants.find((v) => v.size === sz);
                        const hasStock = (variantForSize?.stock_quantity ?? 0) > 0;
                        return (
                          <button
                            key={sz}
                            onClick={() => setSelectedSize(sz)}
                            disabled={!hasStock}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                              selectedSize === sz
                                ? 'bg-[#121212] text-white shadow-md'
                                : hasStock
                                ? 'bg-white border border-[#E8E6E1] text-[#121212] hover:border-black'
                                : 'bg-[#F5F3EF] text-[#A8A49C] border border-[#E8E6E1] line-through cursor-not-allowed'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Color Selection */}
                {allColors.length > 1 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-[#121212] mb-2">
                      <span>Color: </span>
                      <span className="font-normal text-[#8C887B]">{selectedColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {allColors.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => setSelectedColor(c.name)}
                          className={`w-7 h-7 rounded-full border-2 transition flex items-center justify-center ${
                            selectedColor === c.name ? 'border-[#121212] scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          title={c.name}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-black/10 inline-block"
                            style={{ backgroundColor: c.hex }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock Feedback */}
                <div className="mt-4 pt-3 border-t border-[#F0EFEA] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    {isOutOfStock ? (
                      <span className="text-[#D9534F] font-semibold flex items-center gap-1">
                        Out of Stock
                      </span>
                    ) : currentStock <= 3 ? (
                      <span className="text-amber-700 font-semibold">
                        Only {currentStock} left in stock - order soon
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> In Stock ({currentStock} available)
                      </span>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  {!isOutOfStock && (
                    <div className="flex items-center border border-[#E8E6E1] rounded-lg overflow-hidden bg-[#FAF9F6]">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="px-2.5 py-1 text-xs text-[#121212] hover:bg-[#E8E6E1] disabled:opacity-30"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-bold font-mono">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                        disabled={quantity >= currentStock}
                        className="px-2.5 py-1 text-xs text-[#121212] hover:bg-[#E8E6E1] disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-4 border-t border-[#E8E6E1]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || isAdding}
                    className="flex-1 py-3.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-[0.15em] rounded-xl hover:bg-black transition shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>{isAdding ? 'Adding to Bag...' : isOutOfStock ? 'Sold Out' : 'Add to Shopping Bag'}</span>
                  </button>

                  <button
                    onClick={() => toggleWishlist(product.id)}
                    className="p-3.5 rounded-xl border border-[#E8E6E1] bg-white text-[#121212] hover:text-[#D9534F] hover:border-black transition cursor-pointer"
                    aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={`w-4 h-4 ${inWishlist ? 'fill-[#D9534F] text-[#D9534F]' : ''}`} />
                  </button>
                </div>

                <Link
                  to={`/product/${product.slug}`}
                  onClick={onClose}
                  className="w-full py-2.5 text-center text-xs font-semibold text-[#8C887B] hover:text-[#121212] transition flex items-center justify-center gap-1.5"
                >
                  <span>View Full Product Specifications & Sizing Guide</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-[#8C887B]">
            Product specifications unavailable.
          </div>
        )}
      </div>
    </div>
  );
};
