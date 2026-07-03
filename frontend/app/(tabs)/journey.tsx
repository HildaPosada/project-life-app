import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useEntitlement } from "@/src/context/EntitlementContext";

// Healing Journey — chapters, not a progress tracker.
// Current chapter is highlighted. Future chapters remain visible but
// understated. Completed chapters become "seasons walked".

const CHAPTER_STORY: Record<number, { purpose: string; experience: string; next: string }> = {
  0: {
    purpose: "To settle, before beginning. To learn where the doors are.",
    experience: "Curiosity, a little nervousness, moments of slowing down.",
    next: "Set your safety net. Read one gentle prompt.",
  },
  1: {
    purpose: "To build a steady practice of noticing. Weekly reflection beside your therapist.",
    experience: "Familiar patterns become visible. Emotions gain vocabulary.",
    next: "A single weekly reflection — anytime this week.",
  },
  2: {
    purpose: "To reprocess specific memories with your therapist. Only with their approval.",
    experience: "Some sessions feel heavy. Others feel lighter than expected. Both are welcome.",
    next: "Upload your therapist's approval. Log one memory.",
  },
  3: {
    purpose: "To integrate somatic and — if part of your care — ketamine work into daily life.",
    experience: "The body speaks more clearly. Meaning arrives slowly, then all at once.",
    next: "Log one integration session. Try a somatic practice.",
  },
};

const ROMAN = ["I", "II", "III", "IV"];

export default function JourneyScreen() {
  const router = useRouter();
  const { isPremium } = useEntitlement();
  const [phases, setPhases] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPhases(await api.listPhases());
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openChapter = (p: any) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/phase/${p.phase}`);
  };

  const walked = phases.filter((p) => p.phase < (phases.find((c) => c.is_current)?.phase ?? 0));
  const current = phases.find((p) => p.is_current);
  const ahead = phases.filter((p) => !p.is_current && p.phase > (current?.phase ?? -1));

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="journey-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>A long, unhurried arc</Text>
        <Text style={styles.title}>Your healing{"\n"}journey.</Text>
        <Text style={styles.subtitle}>
          Four seasons, walked in sequence. Not a race, not a checklist — a story.
        </Text>

        {walked.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Seasons walked</Text>
            {walked.map((p) => (
              <Pressable
                key={p.phase}
                onPress={() => openChapter(p)}
                style={styles.walkedRow}
                testID={`journey-walked-${p.phase}`}
              >
                <Text style={styles.walkedNum}>{ROMAN[p.phase]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walkedTitle}>{p.title}</Text>
                  <Text style={styles.walkedDur}>{p.duration}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.onSurfaceTertiary} />
              </Pressable>
            ))}
          </View>
        )}

        {current && (
          <Pressable
            onPress={() => openChapter(current)}
            style={({ pressed }) => [styles.currentCard, pressed && styles.pressed]}
            testID={`journey-current-${current.phase}`}
          >
            <Text style={styles.currentNum}>{ROMAN[current.phase]}</Text>
            <Text style={styles.currentEyebrow}>Where you are</Text>
            <Text style={styles.currentTitle}>{current.title}</Text>
            <Text style={styles.currentDur}>{current.duration}</Text>

            <View style={styles.rule} />

            <Text style={styles.paraLabel}>Purpose</Text>
            <Text style={styles.para}>{CHAPTER_STORY[current.phase]?.purpose}</Text>

            <Text style={styles.paraLabel}>What you may experience</Text>
            <Text style={styles.para}>{CHAPTER_STORY[current.phase]?.experience}</Text>

            <Text style={styles.paraLabel}>A gentle next step</Text>
            <Text style={styles.paraGold}>{CHAPTER_STORY[current.phase]?.next}</Text>

            <View style={styles.continueRow}>
              <Text style={styles.continueText}>Continue this chapter</Text>
              <Feather name="arrow-right" size={18} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
        )}

        {ahead.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Chapters ahead</Text>
            {ahead.map((p) => {
              const requiresPremium = !isPremium && p.phase >= 2;
              return (
                <Pressable
                  key={p.phase}
                  onPress={() => {
                    if (requiresPremium) {
                      Haptics.selectionAsync().catch(() => {});
                      router.push("/paywall");
                      return;
                    }
                    openChapter(p);
                  }}
                  style={styles.aheadRow}
                  testID={`journey-ahead-${p.phase}`}
                >
                  <Text style={styles.aheadNum}>{ROMAN[p.phase]}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.aheadTitleRow}>
                      <Text style={styles.aheadTitle}>{p.title}</Text>
                      {requiresPremium ? (
                        <View style={styles.premiumTag}>
                          <Feather name="feather" size={10} color={colors.onAccent} />
                          <Text style={styles.premiumTagText}>Premium</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.aheadPurpose} numberOfLines={2}>
                      {CHAPTER_STORY[p.phase]?.purpose}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.onSurfaceTertiary} />
                </Pressable>
              );
            })}
          </View>
        )}

        {!isPremium && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push("/paywall");
            }}
            style={({ pressed }) => [styles.premiumInvite, pressed && { opacity: 0.94 }]}
            testID="journey-premium-invite"
          >
            <Text style={styles.premiumInviteEyebrow}>A quiet invitation</Text>
            <Text style={styles.premiumInviteTitle}>The full arc opens with Premium.</Text>
            <Text style={styles.premiumInviteBody}>
              Your first chapter is free, always. When you are ready to walk further, the remaining
              seasons are waiting.
            </Text>
            <View style={styles.premiumInviteRow}>
              <Text style={styles.premiumInviteCta}>See what unfolds</Text>
              <Feather name="arrow-right" size={16} color={colors.brandPrimary} />
            </View>
          </Pressable>
        )}

        <Text style={styles.closing}>Move gently. The story will keep.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl },

  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  title: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.onSurface, fontWeight: "500" },
  subtitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontStyle: "italic", marginTop: spacing.md, marginBottom: spacing.xxl, lineHeight: 26 },

  block: { marginBottom: spacing.xxl },
  blockLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },

  walkedRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  walkedNum: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurfaceTertiary, width: 40, fontWeight: "500" },
  walkedTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface },
  walkedDur: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginTop: 2 },

  pressed: { opacity: 0.92 },
  currentCard: { backgroundColor: colors.brandPrimary, padding: spacing.xl, borderRadius: radius.md, marginBottom: spacing.xxl },
  currentNum: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 60, color: colors.brandTertiary, fontWeight: "500" },
  currentEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.brandTertiary, letterSpacing: 2, textTransform: "uppercase", marginTop: spacing.md, marginBottom: spacing.xs },
  currentTitle: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.onBrandPrimary, fontWeight: "500" },
  currentDur: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.brandTertiary, marginTop: spacing.xs, letterSpacing: 0.5 },
  rule: { height: 1, backgroundColor: colors.brandSecondary, opacity: 0.5, marginVertical: spacing.xl },
  paraLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.brandTertiary, letterSpacing: 2, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.xs },
  para: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, lineHeight: 24 },
  paraGold: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.accent, lineHeight: 26, fontStyle: "italic" },
  continueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.brandSecondary },
  continueText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, letterSpacing: 0.5, fontWeight: "500" },

  aheadRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, opacity: 0.7 },
  aheadNum: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurfaceTertiary, width: 40, fontWeight: "500" },
  aheadTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  aheadTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface },
  aheadPurpose: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 4, lineHeight: 20 },
  premiumTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  premiumTagText: { fontFamily: fonts.body, fontSize: 10, color: colors.onAccent, letterSpacing: 1, textTransform: "uppercase" },

  premiumInvite: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  premiumInviteEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  premiumInviteTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onSurface, lineHeight: 32, fontWeight: "500" },
  premiumInviteBody: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: spacing.md, lineHeight: 22 },
  premiumInviteRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  premiumInviteCta: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.brandPrimary, fontWeight: "500", letterSpacing: 0.3 },

  closing: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurfaceTertiary, fontStyle: "italic", textAlign: "center", marginTop: spacing.xxl },
});
