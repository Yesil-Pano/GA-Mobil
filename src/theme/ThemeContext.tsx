import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'dark' | 'light';

/** Faz 2: tipografi +2 */
export const FONT_BUMP = 2;

export function fs(size: number): number {
  return size + FONT_BUMP;
}

export type AppColors = {
  bg: string;
  surface: string;
  header: string;
  border: string;
  text: string;
  textSecondary: string;
  muted: string;
  faint: string;
  orange: string;
  navy: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
  tabInactive: string;
};

export const darkColors: AppColors = {
  bg: '#0F172A',
  surface: '#1E293B',
  header: '#1A233A',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#E2E8F0',
  muted: '#94A3B8',
  faint: '#64748B',
  orange: '#F97316',
  navy: '#1A233A',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#38BDF8',
  tabInactive: '#64748B',
};

export const lightColors: AppColors = {
  bg: '#F1F5F9',
  surface: '#FFFFFF',
  header: '#1A233A',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#1E293B',
  muted: '#64748B',
  faint: '#94A3B8',
  orange: '#F97316',
  navy: '#1A233A',
  danger: '#EF4444',
  success: '#16A34A',
  warning: '#D97706',
  info: '#0284C8',
  tabInactive: '#94A3B8',
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: AppColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  fs: typeof fs;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'ga_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && (saved === 'dark' || saved === 'light')) setModeState(saved);
      } catch {
        /* keep default */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    isDark: mode === 'dark',
    setMode,
    toggleMode,
    fs,
  }), [mode, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
