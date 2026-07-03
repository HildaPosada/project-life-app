import { ReactNode } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useEntitlement } from "@/src/context/EntitlementContext";

// PremiumGate — a soft, editorial lock. Never punitive, never a hard wall.
// Renders `children` when the user has premium; otherwise renders an
// invitation to open the paywall. Following the design constitution: no
// scarcity language, no percentages, no urgency.
export function PremiumGate({
  children,
  eyebrow = "A quiet threshold",
  title = "This chapter unfolds with Premium",
  body = "You already have everything you need to begin. When you're ready to walk further, Premium opens the rest of the journey.",
  cta = "See what unfolds",
  compact = false,
}: {
  children?: ReactNode;
  eyebrow?: string;
  title?: string;
  body?: string;
  cta?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { isPremium } = useEntitlement();

  if (isPremium) return <>{children}</>;

  const openPaywall = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/paywall");
  };

  if (compact) {
    return (
      <Pressable
        onPress={openPaywall}
        style={({ pressed }) => [styles.compact, pressed && styles.pressed]}
        testID="premium-gate-compact"
      >
        <Feather name="feather" size={14} color={colors.accent} />
        <Text style={styles.compactText}>Premium chapter</Text>
        <Feather name="chevron-right" size={14} color={colors.onSurfaceTertiary} />
      </Pressable>
    );
  }

  return (
    <View style={styles.card} testID="premium-gate">
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        onPress={openPaywall}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        testID="premium-gate-cta"
      >
        <Text style={styles.ctaText}>{cta}</Text>
        <Feather name="arrow-right" size={16} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginVertical: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.onSurfaceTertiary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: fontSize.xxl,
    color: colors.onSurface,
    lineHeight: 34,
    fontWeight: "500",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
    minHeight: 48,
  },
  ctaText: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.onBrandPrimary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.9 },

  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.onBrandTertiary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
