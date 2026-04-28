"use client";

import { THEME_STORAGE_KEY, type AppTheme, readThemeFromStorage } from "@/lib/theme";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

type ThemeCtx = {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

function applyDocumentTheme(t: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");

  useLayoutEffect(() => {
    setThemeState(readThemeFromStorage());
  }, []);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
    applyDocumentTheme(t);
  }, []);

  useLayoutEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme must be used under ThemeProvider");
  return c;
}
