import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IndianRupee, RotateCcw, Check, Sparkles, Filter } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';

export interface PricePreset {
  id: string;
  label: string;
  min: number;
  max: number;
  count?: number;
}

interface PriceRangeSliderProps {
  minLimit?: number; // Defaults to 150
  maxLimit?: number; // Dynamically loaded from catalog
  currentMin: number;
  currentMax: number;
  presetCounts?: Record<string, number>;
  onChange: (min: number, max: number) => void;
  onApply?: () => void;
  isMobileDrawer?: boolean;
}

export const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  minLimit = 150,
  maxLimit = 58500,
  currentMin,
  currentMax,
  presetCounts,
  onChange,
  onApply,
  isMobileDrawer = false,
}) => {
  // Ensure valid values within limits
  const safeMinLimit = Math.max(0, minLimit);
  const safeMaxLimit = Math.max(safeMinLimit + 100, maxLimit);

  // Local drag values for butter-smooth visual response
  const [localMin, setLocalMin] = useState<number>(() => Math.max(safeMinLimit, currentMin || safeMinLimit));
  const [localMax, setLocalMax] = useState<number>(() => Math.min(safeMaxLimit, currentMax || safeMaxLimit));
  
  // Direct text input states
  const [inputMin, setInputMin] = useState<string>(() => String(localMin));
  const [inputMax, setInputMax] = useState<string>(() => String(localMax));

  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const step = 50; // Granular step for smooth control

  // Sync when props change from external URL / resets
  useEffect(() => {
    const nextMin = Math.max(safeMinLimit, currentMin || safeMinLimit);
    const nextMax = Math.min(safeMaxLimit, currentMax || safeMaxLimit);
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    setInputMin(String(nextMin));
    setInputMax(String(nextMax));
  }, [currentMin, currentMax, safeMinLimit, safeMaxLimit]);

  // Percentage calculations for track highlight and handles
  const minPercent = Math.max(0, Math.min(100, ((localMin - safeMinLimit) / (safeMaxLimit - safeMinLimit)) * 100));
  const maxPercent = Math.max(0, Math.min(100, ((localMax - safeMinLimit) / (safeMaxLimit - safeMinLimit)) * 100));

  // Commit value change to parent
  const commitChange = useCallback(
    (newMin: number, newMax: number) => {
      onChange(newMin, newMax);
    },
    [onChange]
  );

  // Pointer drag handler for touch and mouse
  const handlePointerDown = (thumb: 'min' | 'max', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveThumb(thumb);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeThumb || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const positionPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawVal = safeMinLimit + positionPercent * (safeMaxLimit - safeMinLimit);
    const steppedVal = Math.round(rawVal / step) * step;

    if (activeThumb === 'min') {
      const clamped = Math.max(safeMinLimit, Math.min(steppedVal, localMax - step));
      setLocalMin(clamped);
      setInputMin(String(clamped));
      commitChange(clamped, localMax);
    } else {
      const clamped = Math.min(safeMaxLimit, Math.max(steppedVal, localMin + step));
      setLocalMax(clamped);
      setInputMax(String(clamped));
      commitChange(localMin, clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeThumb) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      setActiveThumb(null);
    }
  };

  // Keyboard navigation for accessibility
  const handleKeyDown = (thumb: 'min' | 'max', e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    else if (e.key === 'PageUp') delta = step * 10;
    else if (e.key === 'PageDown') delta = -step * 10;
    else if (e.key === 'Home') delta = -100000;
    else if (e.key === 'End') delta = 100000;
    else return;

    e.preventDefault();

    if (thumb === 'min') {
      const targetVal = e.key === 'Home' ? safeMinLimit : e.key === 'End' ? localMax - step : localMin + delta;
      const clamped = Math.max(safeMinLimit, Math.min(targetVal, localMax - step));
      setLocalMin(clamped);
      setInputMin(String(clamped));
      commitChange(clamped, localMax);
    } else {
      const targetVal = e.key === 'Home' ? localMin + step : e.key === 'End' ? safeMaxLimit : localMax + delta;
      const clamped = Math.min(safeMaxLimit, Math.max(targetVal, localMin + step));
      setLocalMax(clamped);
      setInputMax(String(clamped));
      commitChange(localMin, clamped);
    }
  };

  // Direct numeric input handlers
  const handleInputMinBlur = () => {
    const val = Number(inputMin);
    if (isNaN(val) || val < safeMinLimit) {
      setLocalMin(safeMinLimit);
      setInputMin(String(safeMinLimit));
      commitChange(safeMinLimit, localMax);
    } else if (val >= localMax) {
      const adjusted = Math.max(safeMinLimit, localMax - step);
      setLocalMin(adjusted);
      setInputMin(String(adjusted));
      commitChange(adjusted, localMax);
    } else {
      setLocalMin(val);
      commitChange(val, localMax);
    }
  };

  const handleInputMaxBlur = () => {
    const val = Number(inputMax);
    if (isNaN(val) || val > safeMaxLimit) {
      setLocalMax(safeMaxLimit);
      setInputMax(String(safeMaxLimit));
      commitChange(localMin, safeMaxLimit);
    } else if (val <= localMin) {
      const adjusted = Math.min(safeMaxLimit, localMin + step);
      setLocalMax(adjusted);
      setInputMax(String(adjusted));
      commitChange(localMin, adjusted);
    } else {
      setLocalMax(val);
      commitChange(localMin, val);
    }
  };

  // Quick Filter Presets
  const presets: PricePreset[] = [
    {
      id: 'under_500',
      label: 'Under ₹500',
      min: 150,
      max: 499,
      count: presetCounts?.under_500,
    },
    {
      id: '500_1000',
      label: '₹500 – ₹1,000',
      min: 500,
      max: 1000,
      count: presetCounts?.['500_1000'],
    },
    {
      id: '1000_2500',
      label: '₹1,000 – ₹2,500',
      min: 1000,
      max: 2500,
      count: presetCounts?.['1000_2500'],
    },
    {
      id: '2500_5000',
      label: '₹2,500 – ₹5,000',
      min: 2500,
      max: 5000,
      count: presetCounts?.['2500_5000'],
    },
    {
      id: '5000_above',
      label: '₹5,000 & Above',
      min: 5000,
      max: safeMaxLimit,
      count: presetCounts?.['5000_above'],
    },
  ];

  const handleApplyPreset = (preset: PricePreset) => {
    const clampedMin = Math.max(safeMinLimit, preset.min);
    const clampedMax = Math.min(safeMaxLimit, preset.max);
    setLocalMin(clampedMin);
    setLocalMax(clampedMax);
    setInputMin(String(clampedMin));
    setInputMax(String(clampedMax));
    commitChange(clampedMin, clampedMax);
  };

  const handleResetPrice = () => {
    setLocalMin(safeMinLimit);
    setLocalMax(safeMaxLimit);
    setInputMin(String(safeMinLimit));
    setInputMax(String(safeMaxLimit));
    commitChange(safeMinLimit, safeMaxLimit);
  };

  const isCustomPrice = localMin > safeMinLimit || localMax < safeMaxLimit;

  return (
    <div className="space-y-4">
      {/* Header & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            Price Range
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold" style={{ backgroundColor: 'var(--bg-surface-alt)', color: 'var(--text-muted)' }}>
            ₹150 – {formatPrice(safeMaxLimit)}
          </span>
        </div>
        {isCustomPrice && (
          <button
            type="button"
            onClick={handleResetPrice}
            className="text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer hover:underline"
            style={{ color: 'var(--accent-primary)' }}
            title="Reset price range to entire catalog"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Current Range Badge Display */}
      <div
        className="p-3 rounded-xl border flex items-center justify-between text-xs transition shadow-2xs"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="text-left">
          <span className="text-[10px] uppercase tracking-wider block font-medium" style={{ color: 'var(--text-muted)' }}>
            Minimum
          </span>
          <span className="font-serif font-extrabold text-sm sm:text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {formatPrice(localMin)}
          </span>
        </div>
        <div className="h-6 w-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider block font-medium" style={{ color: 'var(--text-muted)' }}>
            Maximum
          </span>
          <span className="font-serif font-extrabold text-sm sm:text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {formatPrice(localMax)}
          </span>
        </div>
      </div>

      {/* Dual Thumb Draggable Range Slider Bar */}
      <div className="py-4 px-2 select-none">
        <div
          ref={trackRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full h-2.5 rounded-full cursor-pointer touch-none"
          style={{ backgroundColor: 'var(--slider-track)' }}
        >
          {/* Highlighted active range track */}
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-75"
            style={{
              left: `${minPercent}%`,
              width: `${Math.max(0, maxPercent - minPercent)}%`,
              backgroundColor: 'var(--accent-primary)',
            }}
          />

          {/* Left / Minimum Thumb Handle */}
          <div
            role="slider"
            tabIndex={0}
            aria-valuemin={safeMinLimit}
            aria-valuemax={localMax - step}
            aria-valuenow={localMin}
            aria-label="Minimum price filter"
            onPointerDown={(e) => handlePointerDown('min', e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={(e) => handleKeyDown('min', e)}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${
              activeThumb === 'min' ? 'scale-125 shadow-xl ring-2' : ''
            }`}
            style={{
              left: `${minPercent}%`,
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent-primary)',
              zIndex: activeThumb === 'min' ? 20 : 10,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            />
          </div>

          {/* Right / Maximum Thumb Handle */}
          <div
            role="slider"
            tabIndex={0}
            aria-valuemin={localMin + step}
            aria-valuemax={safeMaxLimit}
            aria-valuenow={localMax}
            aria-label="Maximum price filter"
            onPointerDown={(e) => handlePointerDown('max', e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={(e) => handleKeyDown('max', e)}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${
              activeThumb === 'max' ? 'scale-125 shadow-xl ring-2' : ''
            }`}
            style={{
              left: `${maxPercent}%`,
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent-primary)',
              zIndex: activeThumb === 'max' ? 20 : 10,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            />
          </div>
        </div>

        {/* Range boundary indicators */}
        <div className="flex justify-between items-center text-[10px] mt-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>
          <span>₹{safeMinLimit}</span>
          <span className="text-[9px] uppercase tracking-wider font-sans font-semibold">Touch / Drag either handle</span>
          <span>{formatPrice(safeMaxLimit)}</span>
        </div>
      </div>

      {/* Manual Numeric Input Boxes */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Min (₹)
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              ₹
            </span>
            <input
              type="number"
              min={safeMinLimit}
              max={localMax - step}
              value={inputMin}
              onChange={(e) => setInputMin(e.target.value)}
              onBlur={handleInputMinBlur}
              className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border focus:outline-hidden focus:border-black transition"
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              aria-label="Minimum price in Rupees"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Max (₹)
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              ₹
            </span>
            <input
              type="number"
              min={localMin + step}
              max={safeMaxLimit}
              value={inputMax}
              onChange={(e) => setInputMax(e.target.value)}
              onBlur={handleInputMaxBlur}
              className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border focus:outline-hidden focus:border-black transition"
              style={{
                backgroundColor: 'var(--input-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              aria-label="Maximum price in Rupees"
            />
          </div>
        </div>
      </div>

      {/* Quick Filter Presets */}
      <div className="pt-2">
        <span className="block text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Quick Filter Presets
        </span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const isPresetActive =
              localMin === preset.min &&
              (preset.id === '5000_above' ? localMax >= preset.max : localMax === preset.max);

            const hasZeroCount = preset.count !== undefined && preset.count === 0;

            return (
              <button
                key={preset.id}
                type="button"
                disabled={hasZeroCount}
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 border ${
                  isPresetActive
                    ? 'shadow-xs font-bold'
                    : hasZeroCount
                    ? 'opacity-40 cursor-not-allowed border-dashed'
                    : 'hover:border-black/30'
                }`}
                style={{
                  backgroundColor: isPresetActive ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: isPresetActive ? 'var(--bg-primary)' : 'var(--text-primary)',
                  borderColor: isPresetActive ? 'var(--text-primary)' : 'var(--border-color)',
                }}
              >
                <span>{preset.label}</span>
                {preset.count !== undefined && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded-full font-mono ${
                      isPresetActive
                        ? 'bg-white/20 text-white'
                        : 'bg-black/5 text-gray-500'
                    }`}
                  >
                    {preset.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Drawer Apply Action */}
      {isMobileDrawer && onApply && (
        <button
          type="button"
          onClick={onApply}
          className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
          style={{
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-primary)',
          }}
        >
          <Check className="w-4 h-4" /> Apply Price Range ({formatPrice(localMin)} – {formatPrice(localMax)})
        </button>
      )}
    </div>
  );
};
