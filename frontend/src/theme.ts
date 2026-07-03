import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Sanctuary — Project Life v2 design language
// Editorial, premium, timeless. Warm neutrals, forest greens, muted gold.
// ---------------------------------------------------------------------------
export const colors = {
  // Backgrounds and surfaces
  surface: "#F7F3ED",            // Warm Linen — app background
  surfaceSecondary: "#EFEAE1",   // page cards
  surfaceTertiary: "#E9E4DD",    // Stone — raised cards
  onSurface: "#2E3130",          // Charcoal — primary text
  onSurfaceSecondary: "#5A5C58", // secondary text
  onSurfaceTertiary: "#8A8C87",  // captions, meta
  surfaceInverse: "#2E3130",
  onSurfaceInverse: "#F7F3ED",

  // Brand
  brand: "#355746",              // Forest — primary brand + CTA
  brandPrimary: "#355746",
  onBrandPrimary: "#F7F3ED",
  brandSecondary: "#8EA68C",     // Sage — supportive
  onBrandSecondary: "#F7F3ED",
  brandTertiary: "#D9D2C4",      // soft stone
  onBrandTertiary: "#2E3130",

  // Accents
  accent: "#B79A63",             // Muted Gold — used sparingly for moments
  onAccent: "#2E3130",

  // Semantic (kept warm & muted, never neon)
  success: "#6E8D74",
  onSuccess: "#F7F3ED",
  warning: "#B79A63",
  onWarning: "#2E3130",
  error: "#9F5A5A",
  onError: "#F7F3ED",
  info: "#8EA68C",
  onInfo: "#F7F3ED",

  // Structural
  border: "#DDD5C6",
  borderStrong: "#C6BDA9",
  divider: "#E5DECF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40,
  xxxl: 56,
};

export const radius = {
  sm: 4,
  md: 10,
  lg: 18,
  pill: 999,
};

// Editorial typography. `serif` = large headings / display moments.
// `body` = readable sans for UI copy. No @expo-google-fonts (forbidden).
export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }) as string,
  displayBold: Platform.select({ ios: "Georgia-Bold", android: "serif", default: "serif" }) as string,
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }) as string,
  body: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  xxxl: 40,
};
