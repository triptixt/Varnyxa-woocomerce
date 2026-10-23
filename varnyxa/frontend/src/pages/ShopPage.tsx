import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Search, AlertCircle, Package } from 'lucide-react';
import { ProductListItem, Category, Brand, PriceBounds } from '../types';
import { api } from '../services/api';
import { formatPrice } from '../utils/formatters';
import { ProductCard } from '../components/product/ProductCard';
import { ProductFilters } from '../components/product/ProductFilters';

export const ShopPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [priceBounds, setPriceBounds] = useState<PriceBounds | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Dynamic limits from catalog bounds (fallback min: 150, fallback max: 58500)
  const minLimit = priceBounds?.min_price ?? 150;
  const maxLimit = priceBounds?.max_price ?? 58500;

  // Extract query filters from URL
  const gender = searchParams.get('gender') || '';
  const ageGroup = searchParams.get('age_group') || '';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const size = searchParams.get('size') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'recommended';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const inStock = searchParams.get('in_stock') === 'true';

  // Read price filters from URL or default to bounds
  const urlMinPrice = searchParams.get('min_price');
  const urlMaxPrice = searchParams.get('max_price');
  const currentMinPrice = urlMinPrice ? Number(urlMinPrice) : minLimit;
  const currentMaxPrice = urlMaxPrice ? Number(urlMaxPrice) : maxLimit;

  // Debounce timer ref for slider URL updates
  const priceDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Categories, Brands & Dynamic Price Bounds on mount
  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        const [cats, brs, bounds] = await Promise.all([
          api.products.getCategories(),
          api.products.getBrands(),
          api.products.getPriceBounds().catch(() => null),
        ]);
        if (isMounted) {
          setCategories(cats);
          setBrands(brs);
          if (bounds) {
            setPriceBounds(bounds);
          }
        }
      } catch (err) {
        console.error('Error fetching metadata or price bounds:', err);
      }
    };
    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch catalog based on searchParams & active filters
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const minParam = urlMinPrice ? Number(urlMinPrice) : undefined;
      const maxParam = urlMaxPrice ? Number(urlMaxPrice) : undefined;

      const params: Record<string, any> = {
        gender: gender || undefined,
        age_group: ageGroup || undefined,
        category: category || undefined,
        brand: brand || undefined,
        size: size || undefined,
        search: search || undefined,
        sort: sort || undefined,
        page: page || 1,
        limit: 12,
        in_stock: inStock ? true : undefined,
        min_price: minParam,
        max_price: maxParam,
      };

      const res = await api.products.getCatalog(params);
      setProducts(res.items);
      setTotalCount(res.total);
      setTotalPages(res.pages);
    } catch (err: any) {
      console.error('Error fetching catalog:', err);
      setFetchError(err.message || 'Unable to connect to the VARNYXA product server.');
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [gender, ageGroup, category, brand, size, search, sort, page, inStock, urlMinPrice, urlMaxPrice]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Query parameter helpers
  const updateQueryParam = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === null || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    newParams.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(newParams);
  };

  // Debounced price range change handler
  const handlePriceChange = useCallback((newMin: number, newMax: number) => {
    if (priceDebounceTimer.current) {
      clearTimeout(priceDebounceTimer.current);
    }

    priceDebounceTimer.current = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams);

      // Only set in URL if different from baseline bounds
      if (newMin > minLimit) {
        newParams.set('min_price', String(newMin));
      } else {
        newParams.delete('min_price');
      }

      if (newMax < maxLimit) {
        newParams.set('max_price', String(newMax));
      } else {
        newParams.delete('max_price');
      }

      newParams.set('page', '1');
      setSearchParams(newParams);
    }, 250);
  }, [searchParams, minLimit, maxLimit, setSearchParams]);

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // Check if custom price filter is active
  const hasCustomPrice = (urlMinPrice !== null && Number(urlMinPrice) > minLimit) || 
                         (urlMaxPrice !== null && Number(urlMaxPrice) < maxLimit);

  // Active filter tags
  const activeFilters = [
    gender && { key: 'gender', label: `Gender: ${gender}` },
    ageGroup && { key: 'age_group', label: `Age: ${ageGroup}` },
    category && { key: 'category', label: `Category: ${category}` },
    size && { key: 'size', label: `Size: ${size}` },
    inStock && { key: 'in_stock', label: 'In Stock' },
    search && { key: 'search', label: `"${search}"` },
    hasCustomPrice && {
      key: 'price',
      label: `Price: ${formatPrice(currentMinPrice)} – ${formatPrice(currentMaxPrice)}`,
    },
  ].filter(Boolean) as { key: string; label: string }[];

  const handleRemoveFilterTag = (key: string) => {
    if (key === 'price') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('min_price');
      newParams.delete('max_price');
      newParams.set('page', '1');
      setSearchParams(newParams);
    } else {
      updateQueryParam(key, null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 animate-page-enter">
      {/* Title & Top Bar */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between pb-4 sm:pb-6 border-b mb-6 sm:mb-8 gap-3 sm:gap-4 transition-colors"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div>
          <h1
            className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            The Clothing Catalog
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Displaying {totalCount} authentic garments crafted for every generation & occasion
          </p>
        </div>

        {/* Sort & Mobile Filter Button */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="lg:hidden flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition border cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span>Filters {activeFilters.length > 0 ? `(${activeFilters.length})` : ''}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
              Sort:
            </span>
            <select
              value={sort}
              onChange={(e) => updateQueryParam('sort', e.target.value)}
              className="text-xs font-semibold rounded-xl px-3 py-2 border focus:outline-none cursor-pointer transition shadow-2xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="discount_desc">Highest Discount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Tags Bar */}
      {activeFilters.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 mb-8 p-3 rounded-2xl border transition-colors shadow-2xs"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>
            Active:
          </span>
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border"
              style={{
                backgroundColor: 'var(--bg-surface-alt)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <span>{f.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilterTag(f.key)}
                className="hover:text-red-500 transition cursor-pointer"
                aria-label={`Remove filter ${f.label}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-red-500 hover:underline ml-2 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Grid Layout: Filters Sidebar + Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-10">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block lg:col-span-1">
          <div
            className="sticky top-28 p-6 rounded-3xl border shadow-xs transition-colors"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <ProductFilters
              categories={categories}
              brands={brands}
              selectedGender={gender}
              onSelectGender={(g) => updateQueryParam('gender', g)}
              selectedAgeGroup={ageGroup}
              onSelectAgeGroup={(a) => updateQueryParam('age_group', a)}
              selectedCategory={category}
              onSelectCategory={(c) => updateQueryParam('category', c)}
              selectedBrand={brand}
              onSelectBrand={(b) => updateQueryParam('brand', b)}
              selectedSize={size}
              onSelectSize={(s) => updateQueryParam('size', s)}
              minPriceLimit={minLimit}
              maxPriceLimit={maxLimit}
              currentMinPrice={currentMinPrice}
              currentMaxPrice={currentMaxPrice}
              presetCounts={priceBounds?.preset_counts}
              onPriceChange={handlePriceChange}
              inStockOnly={inStock}
              onToggleInStock={(val) => updateQueryParam('in_stock', val ? 'true' : null)}
              onReset={handleResetFilters}
            />
          </div>
        </aside>

        {/* Product Grid & Pagination */}
        <main className="lg:col-span-3 space-y-10">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-2xl border animate-shimmer relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
                {products.map((p, idx) => (
                  <ProductCard key={p.id} product={p} index={idx} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div
                  className="flex items-center justify-center gap-1.5 sm:gap-2 pt-6 sm:pt-8 border-t transition-colors"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <button
                    onClick={() => updateQueryParam('page', String(Math.max(1, page - 1)))}
                    disabled={page <= 1}
                    className="p-2 sm:p-2.5 rounded-xl border disabled:opacity-30 transition cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                    <button
                      key={pNum}
                      onClick={() => updateQueryParam('page', String(pNum))}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                        page === pNum ? 'shadow-md' : 'border'
                      }`}
                      style={{
                        backgroundColor: page === pNum ? 'var(--text-primary)' : 'var(--bg-surface)',
                        color: page === pNum ? 'var(--bg-primary)' : 'var(--text-primary)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {pNum}
                    </button>
                  ))}

                  <button
                    onClick={() => updateQueryParam('page', String(Math.min(totalPages, page + 1)))}
                    disabled={page >= totalPages}
                    className="p-2 sm:p-2.5 rounded-xl border disabled:opacity-30 transition cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : fetchError ? (
            <div
              className="py-20 text-center rounded-3xl border p-8 space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Wardrobe Service Unavailable
                </h3>
                <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                  {fetchError}
                </p>
              </div>
              <button
                onClick={() => fetchCatalog()}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-sm cursor-pointer"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                Retry Connection
              </button>
            </div>
          ) : activeFilters.length === 0 ? (
            <div
              className="py-20 text-center rounded-3xl border p-8 space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--bg-surface-alt)', color: 'var(--text-muted)' }}
              >
                <Package className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Wardrobe Catalog Awaiting Initial Collections
                </h3>
                <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
                  The database currently has no active garments. As an authorized administrator, you can add authentic garments, sizes, fabrics, and imagery through the operations portal.
                </p>
              </div>
              <Link
                to="/admin"
                className="inline-block px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-sm"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                Open Admin Dashboard
              </Link>
            </div>
          ) : (
            <div
              className="py-20 text-center rounded-3xl border p-8 space-y-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: 'var(--bg-surface-alt)', color: 'var(--text-muted)' }}
              >
                <Search className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  No garments match your filters
                </h3>
                <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                  Try broadening your price range, choosing another generation or category, or resetting all filters.
                </p>
              </div>
              <button
                onClick={handleResetFilters}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-primary)',
                }}
              >
                Reset All Filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filters Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileFilterOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div
              className="w-full sm:w-screen max-w-full sm:max-w-sm shadow-2xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto pb-safe transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
              }}
            >
              <div
                className="flex items-center justify-between pb-3 sm:pb-4 border-b"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <h3
                  className="font-serif text-base font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Filters {activeFilters.length > 0 ? `(${activeFilters.length})` : ''}
                </h3>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 rounded-lg cursor-pointer transition hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 flex-1">
                <ProductFilters
                  categories={categories}
                  brands={brands}
                  selectedGender={gender}
                  onSelectGender={(g) => updateQueryParam('gender', g)}
                  selectedAgeGroup={ageGroup}
                  onSelectAgeGroup={(a) => updateQueryParam('age_group', a)}
                  selectedCategory={category}
                  onSelectCategory={(c) => updateQueryParam('category', c)}
                  selectedBrand={brand}
                  onSelectBrand={(b) => updateQueryParam('brand', b)}
                  selectedSize={size}
                  onSelectSize={(s) => updateQueryParam('size', s)}
                  minPriceLimit={minLimit}
                  maxPriceLimit={maxLimit}
                  currentMinPrice={currentMinPrice}
                  currentMaxPrice={currentMaxPrice}
                  presetCounts={priceBounds?.preset_counts}
                  onPriceChange={handlePriceChange}
                  onApplyPrice={() => setIsMobileFilterOpen(false)}
                  isMobileDrawer={true}
                  inStockOnly={inStock}
                  onToggleInStock={(val) => updateQueryParam('in_stock', val ? 'true' : null)}
                  onReset={handleResetFilters}
                />
              </div>

              <div
                className="pt-3 sm:pt-4 border-t sticky bottom-0 pb-2 transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="w-full py-3.5 text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer"
                  style={{
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  Apply & View Results ({totalCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
