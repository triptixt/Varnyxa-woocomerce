import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeId = 'black' | 'white' | 'light-green' | 'light-orange';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  palette: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentContrast: string;
  };
  swatches: string[]; // 3 preview colors: [bg, accent, text]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'black',
    name: 'Black Theme',
    tagline: 'Dark luxury backgrounds, readable light text & refined champagne gold',
    palette: {
      background: '#0F0F11',
      surface: '#18181B',
      surfaceAlt: '#27272A',
      border: '#3F3F46',
      text: '#F4F4F5',
      textMuted: '#A1A1AA',
      accent: '#D4AF37',
      accentHover: '#E5C158',
      accentContrast: '#0F0F11',
    },
    swatches: ['#0F0F11', '#D4AF37', '#F4F4F5'],
  },
  {
    id: 'white',
    name: 'White Theme',
    tagline: 'Clean white surfaces, deep dark text & subtle neutral borders',
    palette: {
      background: '#FFFFFF',
      surface: '#F9FAFB',
      surfaceAlt: '#F3F4F6',
      border: '#E5E7EB',
      text: '#111827',
      textMuted: '#6B7280',
      accent: '#18181B',
      accentHover: '#27272A',
      accentContrast: '#FFFFFF',
    },
    swatches: ['#FFFFFF', '#18181B', '#111827'],
  },
  {
    id: 'light-green',
    name: 'Light Green Theme',
    tagline: 'Soft green serene surfaces, readable forest text & emerald accents',
    palette: {
      background: '#F0FDF4',
      surface: '#FFFFFF',
      surfaceAlt: '#DCFCE7',
      border: '#BBF7D0',
      text: '#14532D',
      textMuted: '#166534',
      accent: '#15803D',
      accentHover: '#166534',
      accentContrast: '#FFFFFF',
    },
    swatches: ['#F0FDF4', '#15803D', '#14532D'],
  },
  {
    id: 'light-orange',
    name: 'Light Orange Theme',
    tagline: 'Warm peach soft backgrounds, readable espresso text & amber accents',
    palette: {
      background: '#FFF7ED',
      surface: '#FFFFFF',
      surfaceAlt: '#FFEDD5',
      border: '#FED7AA',
      text: '#431407',
      textMuted: '#7C2D12',
      accent: '#EA580C',
      accentHover: '#C2410C',
      accentContrast: '#FFFFFF',
    },
    swatches: ['#FFF7ED', '#EA580C', '#431407'],
  },
];

interface ThemeContextType {
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  theme: ThemeDefinition;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'varnyxa_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && (saved === 'black' || saved === 'white' || saved === 'light-green' || saved === 'light-orange')) {
        return saved as ThemeId;
      }
      // Migrate old theme names if present
      if (saved === 'midnight-luxe') return 'black';
      if (saved === 'classic-ivory') return 'white';
      if (saved === 'emerald-edit') return 'light-green';
      if (saved === 'terracotta-earth' || saved === 'rose-atelier') return 'light-orange';
    } catch {
      // Fallback
    }
    return 'white';
  });

  const activeThemeDef = useMemo(() => {
    return THEMES.find((t) => t.id === currentTheme) || THEMES[1];
  }, [currentTheme]);

  const setTheme = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (e) {
      console.warn('Unable to persist theme to localStorage', e);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', currentTheme);

    // Apply dark class for Tailwind when in black theme
    if (currentTheme === 'black') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Centralize CSS custom properties directly on :root
    const { palette } = activeThemeDef;
    root.style.setProperty('--bg-primary', palette.background);
    root.style.setProperty('--bg-surface', palette.surface);
    root.style.setProperty('--bg-surface-alt', palette.surfaceAlt);
    root.style.setProperty('--border-color', palette.border);
    root.style.setProperty('--text-primary', palette.text);
    root.style.setProperty('--text-muted', palette.textMuted);
    root.style.setProperty('--accent-primary', palette.accent);
    root.style.setProperty('--accent-hover', palette.accentHover);
    root.style.setProperty('--accent-contrast', palette.accentContrast);
  }, [currentTheme, activeThemeDef]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        theme: activeThemeDef,
        availableThemes: THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
