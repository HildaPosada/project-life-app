import { Platform } from "react-native";

export const colors = {
  surface: "#F9F8F5",
  onSurface: "#3D3A36",
  surfaceSecondary: "#F2EFE8",
  onSurfaceSecondary: "#59544D",
  surfaceTertiary: "#EAE5DC",
  onSurfaceTertiary: "#6E685F",
  surfaceInverse: "#2C2926",
  onSurfaceInverse: "#F9F8F5",
  brand: "#7C8D7C",
  brandPrimary: "#7C8D7C",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B78775",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#D2D6CB",
  onBrandTertiary: "#454D45",
  success: "#819A82",
  onSuccess: "#FFFFFF",
  warning: "#C49A6C",
  onWarning: "#FFFFFF",
  error: "#B77575",
  onError: "#FFFFFF",
  info: "#919A96",
  onInfo: "#FFFFFF",
  border: "#E2DCD1",
  borderStrong: "#C8BEB0",
  divider: "#E6E1D6",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

// Font families — falling back to system serif/sans so we do not pull
// @expo-google-fonts (forbidden per platform rules).
export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }) as string,
  displayBold: Platform.select({ ios: "Georgia-Bold", android: "serif", default: "serif" }) as string,
  body: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
