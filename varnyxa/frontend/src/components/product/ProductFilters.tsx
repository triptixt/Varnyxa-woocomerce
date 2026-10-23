import React from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { Category, Brand } from '../../types';
import { PriceRangeSlider } from '../shop/PriceRangeSlider';

interface ProductFiltersProps {
  categories: Category[];
  brands?: Brand[];
  selectedGender: string;
  onSelectGender: (gender: string) => void;
  selectedAgeGroup: string;
  onSelectAgeGroup: (age: string) => void;
  selectedCategory: string;
  onSelectCategory: (catSlug: string) => void;
  selectedBrand?: string;
  onSelectBrand?: (brandSlug: string) => void;
  selectedSize: string;
  onSelectSize: (size: string) => void;
  minPriceLimit?: number;
  maxPriceLimit?: number;
  currentMinPrice: number;
  currentMaxPrice: number;
  presetCounts?: Record<string, number>;
  onPriceChange: (min: number, max: number) => void;
  onApplyPrice?: () => void;
  isMobileDrawer?: boolean;
  inStockOnly: boolean;
  onToggleInStock: (val: boolean) => void;
  onReset: () => void;
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  selectedGender,
  onSelectGender,
  selectedAgeGroup,
  onSelectAgeGroup,
  selectedCategory,
  onSelectCategory,
  selectedSize,
  onSelectSize,
  minPriceLimit = 150,
  maxPriceLimit = 58500,
  currentMinPrice,
  currentMaxPrice,
  presetCounts,
  onPriceChange,
  onApplyPrice,
  isMobileDrawer = false,
  inStockOnly,
  onToggleInStock,
  onReset,
}) => {
  const genders = [
    { label: 'All Genders', value: '' },
    { label: 'Men', value: 'men' },
    { label: 'Women', value: 'women' },
    { label: 'Unisex', value: 'unisex' },
    { label: 'Girls', value: 'girls' },
    { label: 'Boys', value: 'boys' },
    { label: 'Baby', value: 'baby' },
  ];

  const ageGroups = [
    { label: 'All Ages', value: '' },
    { label: 'Adults', value: 'adults' },
    { label: 'Teens', value: 'teens' },
    { label: 'Kids', value: 'kids' },
    { label: 'Toddler', value: 'toddler' },
    { label: 'Infant', value: 'infant' },
    { label: 'Newborn', value: 'newborn' },
    { label: 'Seniors', value: 'seniors' },
  ];

  const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38R', '40R', '42R', '0-3M', '3-6M', '4-5Y', '6-7Y'];

  return (
    <div className="space-y-6 text-sm">
      {/* Reset Filter Header */}
      <div
        className="flex items-center justify-between pb-3 border-b"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <span
          className="font-serif text-base font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-primary)' }}
        >
          Refine Garments
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-xs flex items-center gap-1 font-semibold transition cursor-pointer hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset All
        </button>
      </div>

      {/* Advanced Dual-Thumb Draggable Price Range Slider */}
      <div
        className="p-4 rounded-2xl border shadow-2xs transition-colors"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <PriceRangeSlider
          minLimit={minPriceLimit}
          maxLimit={maxPriceLimit}
          currentMin={currentMinPrice}
          currentMax={currentMaxPrice}
          presetCounts={presetCounts}
          onChange={onPriceChange}
          onApply={onApplyPrice}
          isMobileDrawer={isMobileDrawer}
        />
      </div>

      {/* In-Stock Toggle */}
      <div
        className="flex items-center justify-between p-3.5 rounded-xl border shadow-2xs transition-colors"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <label
          htmlFor="inStock"
          className="text-xs font-semibold cursor-pointer"
          style={{ color: 'var(--text-primary)' }}
        >
          In-Stock Garments Only
        </label>
        <input
          id="inStock"
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => onToggleInStock(e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer accent-[var(--accent-primary)]"
        />
      </div>

      {/* Gender */}
      <div>
        <h4
          className="text-xs font-bold uppercase tracking-wider mb-2.5"
          style={{ color: 'var(--text-primary)' }}
        >
          Gender
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {genders.map((g) => {
            const isSelected = selectedGender === g.value;
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => onSelectGender(g.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isSelected ? 'shadow-xs font-semibold' : 'border hover:border-black/30'
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category */}
      <div>
        <h4
          className="text-xs font-bold uppercase tracking-wider mb-2.5"
          style={{ color: 'var(--text-primary)' }}
        >
          Category
        </h4>
        <div
          className="space-y-1 max-h-52 overflow-y-auto pr-1 p-1 rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => onSelectCategory('')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
              selectedCategory === '' ? 'font-bold' : ''
            }`}
            style={{
              backgroundColor: selectedCategory === '' ? 'var(--bg-surface-alt)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <span>All Categories</span>
            {selectedCategory === '' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />}
          </button>
          {categories.map((c) => {
            const isSelected = selectedCategory === c.slug;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCategory(c.slug)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                  isSelected ? 'font-bold' : ''
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-surface-alt)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <span>{c.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generation & Age Group */}
      <div>
        <h4
          className="text-xs font-bold uppercase tracking-wider mb-2.5"
          style={{ color: 'var(--text-primary)' }}
        >
          Generation & Age
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {ageGroups.map((a) => {
            const isSelected = selectedAgeGroup === a.value;
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => onSelectAgeGroup(a.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isSelected ? 'shadow-xs font-semibold' : 'border hover:border-black/30'
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sizes */}
      <div>
        <h4
          className="text-xs font-bold uppercase tracking-wider mb-2.5"
          style={{ color: 'var(--text-primary)' }}
        >
          Sizes
        </h4>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {standardSizes.map((s) => {
            const isSelected = selectedSize === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSize(selectedSize === s ? '' : s)}
                className={`py-1.5 text-xs font-semibold rounded-lg text-center transition cursor-pointer ${
                  isSelected ? 'shadow-xs font-bold' : 'border hover:border-black/30'
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
