import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Heart,
  Star,
  Truck,
  Check,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Ruler,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ProductDetail, ProductVariant, Review, ProductListItem } from '../types';
import { api } from '../services/api';
import { formatPrice } from '../utils/formatters';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ProductCard } from '../components/product/ProductCard';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pincode, setPincode] = useState<string>('');
  const [pincodeResult, setPincodeResult] = useState<string | null>(null);

  // Review Form state
  const [newRating, setNewRating] = useState<number>(5);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const prod = await api.products.getBySlug(slug);
        setProduct(prod);

        // Default image
        const primaryImg = prod.images.find((i) => i.is_primary) || prod.images[0];
        if (primaryImg) setSelectedImage(primaryImg.image_url);

        // Pre-select first available variant
        const firstInStock = prod.variants.find((v) => v.stock_quantity > 0) || prod.variants[0];
        if (firstInStock) {
          setSelectedSize(firstInStock.size);
          setSelectedColor(firstInStock.color_name);
        }

        // Fetch reviews & related
        const [revs, rel] = await Promise.all([
          api.reviews.getByProduct(prod.id),
          api.products.getRelated(prod.id, 4),
        ]);
        setReviews(revs);
        setRelatedProducts(rel);
      } catch (err: any) {
        error(err.message || 'Product not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-pulse">
          <div className="aspect-[3/4] bg-white rounded-3xl border border-[#E8E6E1]" />
          <div className="space-y-6">
            <div className="h-8 bg-white rounded-xl w-3/4" />
            <div className="h-6 bg-white rounded-xl w-1/3" />
            <div className="h-24 bg-white rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4 space-y-4">
        <h2 className="font-serif text-2xl font-bold">Garment Not Found</h2>
        <p className="text-xs text-[#8C887B]">The requested fashion piece is unavailable or has been archived.</p>
        <Link
          to="/shop"
          className="inline-block px-6 py-3 bg-[#121212] text-white text-xs font-bold uppercase rounded-xl"
        >
          Return to Editions
        </Link>
      </div>
    );
  }

  // Find variant matching selected size and color
  const matchedVariant: ProductVariant | undefined = product.variants.find(
    (v) => v.size === selectedSize && v.color_name === selectedColor
  ) || product.variants.find((v) => v.size === selectedSize) || product.variants[0];

  const effectivePrice = matchedVariant?.price_override ?? (product.sale_price || product.base_price);
  const currentStock = matchedVariant?.stock_quantity ?? 0;
  const isOutOfStock = currentStock <= 0;

  // Available unique sizes and colors
  const allSizes = Array.from(new Set(product.variants.map((v) => v.size)));
  const allColors = Array.from(
    new Map(product.variants.map((v) => [v.color_name, { name: v.color_name, hex: v.color_hex }])).values()
  );

  const handleAddToCart = async () => {
    if (!matchedVariant) {
      error('Please choose a valid size and color.');
      return;
    }
    if (isOutOfStock) {
      error('Selected garment variant is out of stock.');
      return;
    }
    await addToCart(matchedVariant.id, quantity);
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    navigate('/checkout');
  };

  const handlePincodeCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode.trim() || pincode.trim().length < 6) {
      setPincodeResult('Please enter a valid 6-digit Indian PIN code.');
      return;
    }
    setPincodeResult(`Delivery confirmed to PIN ${pincode}: Estimated arrival within 2-4 business days.`);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      error('Please sign in to submit a review.');
      return;
    }
    setIsSubmittingReview(true);
    try {
      const newRev = await api.reviews.submit({
        product_id: product.id,
        rating: newRating,
        title: newTitle || undefined,
        comment: newComment,
      });
      setReviews([newRev, ...reviews]);
      setNewComment('');
      setNewTitle('');
      success('Review submitted successfully! Thank you for sharing your experience.');
    } catch (err: any) {
      error(err.message || 'Could not submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Touch swipe support for mobile gallery
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !product || product.images.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      // Swipe left -> Next image
      const nextIdx = (currentImageIndex + 1) % product.images.length;
      setCurrentImageIndex(nextIdx);
      setSelectedImage(product.images[nextIdx].image_url);
    } else if (diff < -45) {
      // Swipe right -> Previous image
      const prevIdx = (currentImageIndex - 1 + product.images.length) % product.images.length;
      setCurrentImageIndex(prevIdx);
      setSelectedImage(product.images[prevIdx].image_url);
    }
    setTouchStartX(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-12 sm:space-y-20 pb-24 lg:pb-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-[#8C887B] uppercase tracking-wider overflow-x-auto whitespace-nowrap pb-1">
        <Link to="/" className="hover:text-black shrink-0">Home</Link>
        <span>/</span>
        <Link to={`/shop?category=${product.category.slug}`} className="hover:text-black shrink-0">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-[#121212] font-semibold truncate max-w-[200px] sm:max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
        {/* Left: Gallery Column */}
        <div className="space-y-3 sm:space-y-4">
          {/* Main Visual with Swipe Support */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative aspect-[3/4] bg-[#F0EFEA] rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E6E1] shadow-md group touch-pan-y"
          >
            <img
              src={selectedImage}
              alt={product.title}
              className="w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-105 select-none"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=1000&q=80';
              }}
            />
            {product.discount_percent > 0 && (
              <span className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#C5A880] text-[#121212] text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-md z-10">
                {product.discount_percent}% Off
              </span>
            )}

            {/* Previous / Next Arrow Controls */}
            {product.images.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const prevIdx = (currentImageIndex - 1 + product.images.length) % product.images.length;
                    setCurrentImageIndex(prevIdx);
                    setSelectedImage(product.images[prevIdx].image_url);
                  }}
                  className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-white/85 text-[#121212] hover:bg-white shadow-lg transition opacity-80 group-hover:opacity-100 z-10 cursor-pointer"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => {
                    const nextIdx = (currentImageIndex + 1) % product.images.length;
                    setCurrentImageIndex(nextIdx);
                    setSelectedImage(product.images[nextIdx].image_url);
                  }}
                  className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-full bg-white/85 text-[#121212] hover:bg-white shadow-lg transition opacity-80 group-hover:opacity-100 z-10 cursor-pointer"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/60 text-white text-[10px] sm:text-xs font-medium backdrop-blur-sm z-10">
                  {currentImageIndex + 1} / {product.images.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail Strip with Snap Scroll */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 no-scrollbar">
              {product.images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  onClick={() => {
                    setSelectedImage(img.image_url);
                    setCurrentImageIndex(idx);
                  }}
                  className={`w-16 h-20 sm:w-20 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    selectedImage === img.image_url
                      ? 'border-[#121212] shadow-md scale-95'
                      : 'border-[#E8E6E1] opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={img.alt_text}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=1000&q=80';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Garment Attributes & Actions */}
        <div className="space-y-7">
          {/* Brand & Title */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#8C887B] mb-1">
              <span>{product.brand?.name || 'VARNYXA Atelier'}</span>
              <span className="text-[11px] bg-[#F5F3EF] px-2 py-0.5 rounded capitalize">
                {product.gender} • {product.age_group}
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#121212] leading-tight">
              {product.title}
            </h1>
            <p className="text-xs text-[#8C887B] font-mono mt-1">SKU: {matchedVariant?.sku || product.sku_prefix}</p>
          </div>

          {/* Rating Snapshot */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[#C5A880]">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(product.rating_average)
                      ? 'fill-[#C5A880] text-[#C5A880]'
                      : 'text-[#D5D2CA]'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-[#121212]">{product.rating_average.toFixed(1)}</span>
            <span className="text-xs text-[#8C887B]">({product.review_count} client reviews)</span>
          </div>

          {/* Pricing */}
          <div className="flex items-baseline gap-2 sm:gap-3 p-3.5 sm:p-4 bg-white rounded-2xl border border-[#E8E6E1] flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#121212]">
              {formatPrice(effectivePrice)}
            </span>
            {product.sale_price && (
              <span className="text-xs sm:text-sm text-[#8C887B] line-through">
                {formatPrice(product.base_price)}
              </span>
            )}
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              Inclusive of all taxes
            </span>
          </div>

          {/* Color Selection */}
          {allColors.length > 0 && (
            <div className="space-y-2 sm:space-y-2.5">
              <div className="flex justify-between items-center text-xs font-semibold text-[#121212]">
                <span className="uppercase tracking-wider">Color: {selectedColor}</span>
              </div>
              <div className="flex items-center gap-3">
                {allColors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedColor === c.name ? 'border-[#121212] scale-110 shadow-md' : 'border-[#E8E6E1]'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Select color ${c.name}`}
                  >
                    {selectedColor === c.name && (
                      <Check className={`w-4 h-4 ${c.hex === '#FDFBF7' || c.hex === '#FAF9F6' ? 'text-black' : 'text-white'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selection */}
          <div className="space-y-2 sm:space-y-2.5">
            <div className="flex justify-between items-center text-xs font-semibold text-[#121212]">
              <span className="uppercase tracking-wider">Select Size: {selectedSize}</span>
              <button
                onClick={() => setIsSizeGuideOpen(true)}
                className="text-[#C5A880] hover:text-[#121212] flex items-center gap-1 font-bold transition"
              >
                <Ruler className="w-3.5 h-3.5" /> Size Guide
              </button>
            </div>
            <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 gap-2">
              {allSizes.map((s) => {
                const variantForSize = product.variants.find((v) => v.size === s);
                const hasStock = variantForSize && variantForSize.stock_quantity > 0;
                return (
                  <button
                    key={s}
                    disabled={!hasStock}
                    onClick={() => setSelectedSize(s)}
                    className={`py-2.5 rounded-xl text-xs font-bold uppercase transition border min-h-[40px] flex items-center justify-center ${
                      selectedSize === s
                        ? 'bg-[#121212] text-white border-[#121212] shadow-md'
                        : hasStock
                        ? 'bg-white text-[#121212] border-[#E8E6E1] hover:border-black'
                        : 'bg-[#F0EFEA] text-[#A09D94] border-transparent cursor-not-allowed line-through'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inventory Availability Notice */}
          <div className="text-xs">
            {isOutOfStock ? (
              <span className="text-[#D9534F] font-bold">Currently Sold Out in this variant</span>
            ) : currentStock <= 5 ? (
              <span className="text-amber-800 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" /> Only {currentStock} garments remaining in stock
              </span>
            ) : (
              <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> In Stock & Ready for Immediate Dispatch
              </span>
            )}
          </div>

          {/* Actions: Add to Cart, Buy Now, Wishlist */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 py-4 bg-[#121212] text-white text-xs font-bold uppercase tracking-[0.15em] rounded-2xl hover:bg-black disabled:opacity-40 transition shadow-xl flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isOutOfStock ? 'Sold Out' : 'Add to Shopping Bag'}</span>
              </button>

              <button
                onClick={() => toggleWishlist(product.id)}
                className={`p-4 rounded-2xl border transition shadow-sm ${
                  isInWishlist(product.id)
                    ? 'bg-[#FFF5F5] border-[#FFB4B8] text-[#D9534F]'
                    : 'bg-white border-[#E8E6E1] text-[#121212] hover:bg-[#FAF9F6]'
                }`}
                aria-label="Toggle Wishlist"
              >
                <Heart className={`w-5 h-5 ${isInWishlist(product.id) ? 'fill-[#D9534F]' : ''}`} />
              </button>
            </div>

            {!isOutOfStock && (
              <button
                onClick={handleBuyNow}
                className="w-full py-3.5 bg-[#C5A880] text-[#121212] text-xs font-bold uppercase tracking-[0.15em] rounded-2xl hover:bg-[#D4AF37] transition shadow-lg flex items-center justify-center gap-2"
              >
                <span>Express Buy Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Postal Code Delivery Checker */}
          <div className="p-4 bg-white rounded-2xl border border-[#E8E6E1] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#121212] uppercase tracking-wider">
              <Truck className="w-4 h-4 text-[#C5A880]" />
              <span>Check Delivery Availability</span>
            </div>
            <form onSubmit={handlePincodeCheck} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit Indian Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 px-3 py-2 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#121212] text-white text-xs font-bold rounded-xl hover:bg-black transition uppercase"
              >
                Verify
              </button>
            </form>
            {pincodeResult && (
              <p className="text-xs text-emerald-800 font-medium mt-1">{pincodeResult}</p>
            )}
          </div>

          {/* Garment Specifications Accordion */}
          <div className="space-y-3 pt-2 text-xs text-[#4A4A4A]">
            <div className="p-4 bg-white rounded-2xl border border-[#E8E6E1] space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[#121212]">Garment Description</h4>
              <p className="leading-relaxed text-[#6E6B64]">{product.description}</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E8E6E1] space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[#121212]">Material & Care</h4>
              <p className="leading-relaxed text-[#6E6B64]">{product.material_care || 'Dry clean or delicate cold wash.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {product.fabric && (
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E6E1]">
                  <span className="text-[10px] font-semibold uppercase text-[#8C887B] block">Fabric</span>
                  <span className="font-bold text-[#121212]">{product.fabric}</span>
                </div>
              )}
              {product.fit && (
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E6E1]">
                  <span className="text-[10px] font-semibold uppercase text-[#8C887B] block">Fit</span>
                  <span className="font-bold text-[#121212]">{product.fit}</span>
                </div>
              )}
              {product.occasion && (
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E6E1]">
                  <span className="text-[10px] font-semibold uppercase text-[#8C887B] block">Occasion</span>
                  <span className="font-bold text-[#121212]">{product.occasion}</span>
                </div>
              )}
              {product.season && (
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E6E1]">
                  <span className="text-[10px] font-semibold uppercase text-[#8C887B] block">Season</span>
                  <span className="font-bold text-[#121212]">{product.season}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews & Client Feedback Section */}
      <section className="pt-12 border-t border-[#E8E6E1] space-y-8">
        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#C5A880]">Client Testimonials</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[#121212] mt-1">
              Verified Client Reviews ({reviews.length})
            </h2>
          </div>
        </div>

        {/* Submit Review Form */}
        <div className="p-6 sm:p-8 bg-white rounded-3xl border border-[#E8E6E1] space-y-4">
          <h3 className="font-serif text-lg font-bold text-[#121212]">Share Your Garment Experience</h3>
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">Your Rating</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className="p-1 text-[#C5A880] hover:scale-110 transition"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= newRating ? 'fill-[#C5A880] text-[#C5A880]' : 'text-[#D5D2CA]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">Review Title</label>
              <input
                type="text"
                placeholder="e.g. Exceptional tailoring and drape"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#121212] mb-1">Your Feedback</label>
              <textarea
                required
                rows={3}
                placeholder="Describe the fabric quality, comfort, and silhouette..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl focus:outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReview || !newComment.trim()}
              className="px-6 py-2.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-black transition disabled:opacity-40"
            >
              {isSubmittingReview ? 'Submitting...' : 'Post Review'}
            </button>
          </form>
        </div>

        {/* Existing Reviews List */}
        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((r) => (
              <div key={r.id} className="p-6 bg-white rounded-2xl border border-[#E8E6E1] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[#C5A880]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= r.rating ? 'fill-[#C5A880] text-[#C5A880]' : 'text-[#D5D2CA]'
                        }`}
                      />
                    ))}
                  </div>
                  {r.is_verified_purchase && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Verified Purchase
                    </span>
                  )}
                </div>
                {r.title && <h4 className="text-sm font-bold text-[#121212]">{r.title}</h4>}
                <p className="text-xs text-[#6E6B64] leading-relaxed">{r.comment}</p>
                <p className="text-[10px] text-[#8C887B] pt-2">— {r.user_name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E6E1]">
            <p className="text-xs text-[#8C887B]">Be the first to review this VARNYXA piece!</p>
          </div>
        )}
      </section>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section className="pt-12 border-t border-[#E8E6E1] space-y-8">
          <div className="text-center space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#C5A880]">Coordinated Ensembles</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[#121212]">
              You May Also Admire
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky Mobile Add to Bag Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E8E6E1] p-3 pb-safe lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div className="min-w-0">
            <span className="text-[10px] text-[#8C887B] uppercase tracking-wider block font-medium">Total</span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="text-base font-extrabold text-[#121212]">{formatPrice(effectivePrice)}</span>
              {product.sale_price && (
                <span className="text-[11px] text-[#8C887B] line-through">{formatPrice(product.base_price)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleWishlist(product.id)}
              className={`p-3 rounded-xl border shrink-0 transition ${
                isInWishlist(product.id)
                  ? 'bg-[#FFF5F5] border-[#FFB4B8] text-[#D9534F]'
                  : 'bg-white border-[#E8E6E1] text-[#121212]'
              }`}
              aria-label="Wishlist"
            >
              <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-[#D9534F]' : ''}`} />
            </button>
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="py-3 px-5 bg-[#121212] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-black disabled:opacity-40 transition shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{isOutOfStock ? 'Sold Out' : 'Add to Bag'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Size Guide Modal */}
      {isSizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 space-y-5 sm:space-y-6 relative border border-[#E8E6E1] shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsSizeGuideOpen(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-full text-[#8C887B] hover:text-[#121212] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#121212]">VARNYXA Bespoke Size Guide</h3>
              <p className="text-xs text-[#8C887B] mt-1">Calibrated in inches according to international haute couture metrics.</p>
            </div>
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F6] text-[#121212] uppercase tracking-wider font-semibold border-b border-[#E8E6E1]">
                  <tr>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Chest (in)</th>
                    <th className="py-2.5 px-3">Waist (in)</th>
                    <th className="py-2.5 px-3">Hip (in)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA] text-[#4A4A4A]">
                  <tr><td className="py-2 px-3 font-bold">XS</td><td className="py-2 px-3">34 - 36</td><td className="py-2 px-3">28 - 30</td><td className="py-2 px-3">35 - 37</td></tr>
                  <tr><td className="py-2 px-3 font-bold">S</td><td className="py-2 px-3">36 - 38</td><td className="py-2 px-3">30 - 32</td><td className="py-2 px-3">37 - 39</td></tr>
                  <tr><td className="py-2 px-3 font-bold">M</td><td className="py-2 px-3">38 - 40</td><td className="py-2 px-3">32 - 34</td><td className="py-2 px-3">39 - 41</td></tr>
                  <tr><td className="py-2 px-3 font-bold">L</td><td className="py-2 px-3">40 - 42</td><td className="py-2 px-3">34 - 36</td><td className="py-2 px-3">41 - 43</td></tr>
                  <tr><td className="py-2 px-3 font-bold">XL</td><td className="py-2 px-3">42 - 44</td><td className="py-2 px-3">36 - 38</td><td className="py-2 px-3">43 - 45</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#8C887B]">All garments include a 1.5-inch bespoke tailoring seam allowance for personalized fitting.</p>
          </div>
        </div>
      )}
    </div>
  );
};
