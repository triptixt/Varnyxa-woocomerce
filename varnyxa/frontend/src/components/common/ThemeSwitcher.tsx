import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles, X } from 'lucide-react';
import { useTheme, ThemeId, THEMES } from '../../context/ThemeContext';

export const ThemeSwitcher: React.FC = () => {
  const { currentTheme, setTheme, theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);

  const handleSelectTheme = (id: ThemeId) => {
    setTheme(id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full border transition cursor-pointer shadow-xs"
        style={{
          borderColor: 'var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
        aria-label="Switch Color Theme"
        aria-expanded={isOpen}
        title={`Current Theme: ${theme.name}. Click to change.`}
      >
        <span
          className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border shadow-2xs shrink-0 flex items-center justify-center"
          style={{
            backgroundColor: theme.palette.accent,
            borderColor: theme.palette.border,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: theme.palette.accentContrast }}
          />
        </span>
        <span className="hidden md:inline text-xs font-semibold tracking-wide">
          {theme.name}
        </span>
        <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C5A880] shrink-0" style={{ color: 'var(--accent-primary)' }} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl shadow-2xl border p-3 z-50 animate-popover"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
          role="menu"
          aria-label="Color Themes"
        >
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-xs font-bold uppercase tracking-wider">
                Select Theme ({THEMES.length})
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:opacity-70 transition cursor-pointer"
              aria-label="Close theme menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-[70vh] sm:max-h-96 overflow-y-auto no-scrollbar pr-0.5">
            {THEMES.map((t) => {
              const isSelected = t.id === currentTheme;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer group ${
                    isSelected ? 'shadow-sm' : 'hover:opacity-95'
                  }`}
                  style={{
                    backgroundColor: isSelected ? t.palette.surfaceAlt : 'transparent',
                    borderColor: isSelected ? t.palette.accent : 'transparent',
                  }}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch Trio */}
                    <div className="flex -space-x-1.5 shrink-0">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                        style={{ backgroundColor: t.palette.background }}
                        title="Background"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                        style={{ backgroundColor: t.palette.accent }}
                        title="Accent"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                        style={{ backgroundColor: t.palette.text }}
                        title="Text"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-bold leading-tight truncate"
                          style={{
                            color: isSelected ? t.palette.text : 'var(--text-primary)',
                          }}
                        >
                          {t.name}
                        </span>
                      </div>
                      <p
                        className="text-[10px] leading-tight mt-0.5 truncate max-w-[180px]"
                        style={{
                          color: isSelected ? t.palette.textMuted : 'var(--text-muted)',
                        }}
                      >
                        {t.tagline}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-xs"
                      style={{
                        backgroundColor: t.palette.accent,
                        color: t.palette.accentContrast,
                      }}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 mt-2 border-t text-[10px] text-center" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>Theme auto-persists across reloads & devices</span>
          </div>
        </div>
      )}
    </div>
  );
};
