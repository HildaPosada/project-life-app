import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useEntitlement } from "@/src/context/EntitlementContext";

// Sanctuary paywall.
// - Editorial layout, no scarcity, no urgency, no percentages.
// - Two products only: monthly and annual. Annual is quietly preferred.
// - The 14-day trial is presented as "an unhurried beginning".
// - The "purchase" button currently uses a mock entitlement toggle so the
//   full paywall + gating loop can be QA'd before RevenueCat / Stripe are
//   wired end-to-end.

const PRODUCTS = [
  {
    id: "pl_premium_annual",
    label: "A year, together",
    priceLabel: "$149.99 / year",
    trailing: "37% quieter than monthly",
    highlighted: true,
  },
  {
    id: "pl_premium_monthly",
    label: "One month at a time",
    priceLabel: "$19.99 / month",
    trailing: "cancel anytime",
    highlighted: false,
  },
];

const PREMIUM_INCLUDES = [
  "The complete Healing Journey — every chapter beyond the first",
  "Guided therapeutic exercises",
  "The full Practices Library",
  "AI Companion (Hyperintelligence) conversations",
  "Advanced insights & patterns",
  "Future therapist and group program integrations",
  "Everything added, gently, over time",
];

const FREE_INCLUDES = [
  "Unlimited journaling",
  "The Memory Path",
  "Sanctuary",
  "Weekly reflections",
  "Safety Net & crisis resources",
  "Find a therapist",
  "The first healing chapter",
];

export default function PaywallScreen() {
  const router = useRouter();
  const { isPremium, entitlement, mockUnlock, mockLock } = useEntitlement();
  const [selected, setSelected] = useState<string>("pl_premium_annual");
  const [purchasing, setPurchasing] = useState(false);

  const onClose = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const beginTrial = async () => {
    setPurchasing(true);
    try {
      await mockUnlock(selected);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Softly return home so the user can immediately experience the new
      // chapters unlocking. No confetti — never confetti.
      router.replace("/(tabs)/home");
    } catch {
      Alert.alert("A quiet moment", "We couldn't complete this just now. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const releasePremium = async () => {
    Alert.alert(
      "Return to Free",
      "This will remove your Premium chapters. You can rejoin whenever you're ready.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Return to Free",
          style: "destructive",
          onPress: async () => {
            await mockLock();
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="paywall-screen">
      <View style={styles.appbar}>
        <Pressable onPress={onClose} style={styles.iconBtn} testID="paywall-close-button">
          <Feather name="x" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Premium</Text>
        <Text style={styles.title}>Walk the{"\n"}full journey.</Text>
        <Text style={styles.subtitle}>
          You already have everything you need to begin. Premium opens the rest of the chapters —
          slowly, on your own timing.
        </Text>

        {isPremium ? (
          <View style={styles.activeCard} testID="paywall-active-card">
            <Feather name="check-circle" size={20} color={colors.brandSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>You are a Premium companion.</Text>
              <Text style={styles.activeSub}>
                Thank you for supporting this quiet work. Every chapter is open to you.
              </Text>
              {entitlement?.expires_at ? (
                <Text style={styles.activeMeta}>
                  Renews {new Date(entitlement.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.productsBlock}>
              {PRODUCTS.map((p) => {
                const active = selected === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelected(p.id);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    style={({ pressed }) => [
                      styles.productCard,
                      active && styles.productCardActive,
                      p.highlighted && styles.productCardPreferred,
                      pressed && styles.pressed,
                    ]}
                    testID={`paywall-product-${p.id}`}
                  >
                    <View style={styles.productTop}>
                      <View style={styles.radioOuter}>
                        {active ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productLabel}>{p.label}</Text>
                        <Text style={styles.productPrice}>{p.priceLabel}</Text>
                      </View>
                      {p.highlighted ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Preferred</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.productTrailing}>{p.trailing}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.trialLine}>14 days, freely — an unhurried beginning.</Text>

            <Pressable
              onPress={beginTrial}
              disabled={purchasing}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              testID="paywall-cta"
            >
              {purchasing ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <>
                  <Text style={styles.ctaText}>Begin your 14 days</Text>
                  <Feather name="arrow-right" size={18} color={colors.onBrandPrimary} />
                </>
              )}
            </Pressable>

            <Text style={styles.fineprint}>
              You can leave at any time. No emails asking you to stay.
            </Text>
          </>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionEyebrow}>What Premium opens</Text>
        {PREMIUM_INCLUDES.map((line) => (
          <View key={line} style={styles.includeRow}>
            <View style={styles.dotGold} />
            <Text style={styles.includeText}>{line}</Text>
          </View>
        ))}

        <Text style={[styles.sectionEyebrow, { marginTop: spacing.xxl }]}>What is always free</Text>
        {FREE_INCLUDES.map((line) => (
          <View key={line} style={styles.includeRow}>
            <View style={styles.dotSage} />
            <Text style={styles.includeText}>{line}</Text>
          </View>
        ))}

        {isPremium ? (
          <Pressable onPress={releasePremium} style={styles.releaseBtn} testID="paywall-release-button">
            <Text style={styles.releaseText}>Return to Free</Text>
          </Pressable>
        ) : null}

        <Text style={styles.closing}>
          Your healing is not a transaction. This is only a way to keep the sanctuary tended.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  eyebrow: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.onSurfaceTertiary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: spacing.lg,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 40,
    lineHeight: 46,
    color: colors.onSurface,
    fontWeight: "500",
    marginTop: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.serif,
    fontSize: fontSize.lg,
    color: colors.onSurfaceSecondary,
    fontStyle: "italic",
    lineHeight: 26,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },

  activeCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.brandSecondary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  activeTitle: {
    fontFamily: fonts.serif,
    fontSize: fontSize.xl,
    color: colors.onSurface,
    fontWeight: "500",
  },
  activeSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  activeMeta: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.md,
  },

  productsBlock: { gap: spacing.md },
  productCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  productCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.surface },
  productCardPreferred: { borderColor: colors.accent },
  productTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandPrimary,
  },
  productLabel: {
    fontFamily: fonts.serif,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    fontWeight: "500",
  },
  productPrice: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.onAccent,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  productTrailing: {
    fontFamily: fonts.serif,
    fontSize: fontSize.sm,
    color: colors.onSurfaceTertiary,
    fontStyle: "italic",
    marginTop: spacing.md,
    marginLeft: 34,
  },

  trialLine: {
    fontFamily: fonts.serif,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: radius.pill,
    minHeight: 52,
  },
  ctaText: {
    fontFamily: fonts.body,
    fontSize: fontSize.lg,
    color: colors.onBrandPrimary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  fineprint: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.onSurfaceTertiary,
    textAlign: "center",
    marginTop: spacing.md,
  },

  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xxl },

  sectionEyebrow: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.onSurfaceTertiary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  includeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 6,
  },
  dotGold: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  dotSage: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandSecondary,
    marginTop: 8,
  },
  includeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.onSurface,
    lineHeight: 24,
  },

  releaseBtn: {
    alignSelf: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
  },
  releaseText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.onSurfaceTertiary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  closing: {
    fontFamily: fonts.serif,
    fontSize: fontSize.base,
    color: colors.onSurfaceTertiary,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: spacing.xxl,
    lineHeight: 24,
  },
  pressed: { opacity: 0.92 },
});
