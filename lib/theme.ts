export type AppTheme = "dark" | "light" | "solar";

export const THEME_STORAGE_KEY = "card-flipper-ui-theme";

export const themeLabels: Record<AppTheme, { title: string; desc: string }> = {
  dark: { title: "Dark", desc: "Default app look" },
  light: { title: "Light", desc: "White and soft gray surfaces" },
  solar: { title: "Solar", desc: "Warm amber and stone" },
};

export function readThemeFromStorage(): AppTheme {
  if (typeof window === "undefined") return "dark";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "solar" || raw === "dark") return raw;
  return "dark";
}

export function getRingOffsetClass(t: AppTheme): string {
  if (t === "light") return "focus:ring-offset-slate-100";
  if (t === "solar") return "focus:ring-offset-amber-950";
  return "focus:ring-offset-slate-950";
}

export function getFlipCardRingOffsetClass(t: AppTheme): string {
  if (t === "light") return "focus:ring-offset-2 focus:ring-offset-slate-50";
  if (t === "solar") return "focus:ring-offset-2 focus:ring-offset-amber-950";
  return "focus:ring-offset-2 focus:ring-offset-slate-950";
}
