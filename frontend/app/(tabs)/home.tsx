import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const AFFIRMATIONS = [
  "one step at a time",
  "the body remembers, and the body can rest",
  "you are already becoming",
  "slow is not the opposite of progress",
  "healing is a season, not a task",
];

function pickAffirmation(): string {
  const d = new Date();
  const idx = (d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % AFFIRMATIONS.length;
  return AFFIRMATIONS[idx];
}

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dash, setDash] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [phases, setPhases] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.dashboard(), api.listPhases()]);
      setDash(d);
      setPhases(p);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const firstName = user?.name?.split(" ")[0] ?? "friend";
  const affirmation = pickAffirmation();
  const currentPhase = phases.find((p) => p.is_current);
  const pct = dash?.journey_progress_pct ?? 0;
  const done = dash?.sessions_completed ?? 0;
  const target = dash?.sessions_target ?? 20;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="today-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.push("/menu")} style={styles.iconBtn} testID="today-menu-button">
          <Feather name="menu" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Project Life</Text>
        <Pressable onPress={() => router.push("/menu")} style={styles.avatar} testID="today-avatar-button">
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial masthead */}
        <View style={styles.masthead}>
          <Text style={styles.eyebrow}>Today, {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
          <Text style={styles.greet}>{timeGreeting()}, {firstName}.</Text>
          <Text style={styles.affirm}>{affirmation}.</Text>
        </View>

        {/* Living sanctuary — abstract landscape that grows with healing */}
        <View style={styles.sanctuary}>
          <View style={styles.sky} />
          {/* horizon */}
          <View style={styles.horizon} />
          {/* sun */}
          <View style={[styles.sun, { opacity: Math.max(0.3, pct / 100) }]} />
          {/* growing tree — height scales with progress */}
          <View style={styles.groundLine} />
          <View style={[styles.trunk, { height: 20 + (pct / 100) * 50 }]} />
          <View style={[styles.canopy, { transform: [{ scale: 0.5 + (pct / 100) * 0.8 }] }]} />
          {/* small stones scattering as progress grows */}
          {done >= 1 && <View style={[styles.stone, { left: "28%", bottom: 16 }]} />}
          {done >= 3 && <View style={[styles.stone, { left: "48%", bottom: 14, transform: [{ scale: 0.8 }] }]} />}
          {done >= 5 && <View style={[styles.stone, { left: "68%", bottom: 18, transform: [{ scale: 1.1 }] }]} />}
          {done >= 8 && <View style={[styles.flower, { left: "38%" }]} />}
          {done >= 12 && <View style={[styles.flower, { left: "58%" }]} />}

          <View style={styles.sanctuaryFooter}>
            <Text style={styles.sanctuaryPct}>Your sanctuary — {pct}%</Text>
            <Text style={styles.sanctuaryMeta}>{done} of {target} tending sessions</Text>
          </View>
        </View>

        {/* Three primary actions — nothing else competes */}
        <View style={styles.actions}>
          <Pressable
            testID="today-continue-button"
            onPress={() => router.push(currentPhase ? `/phase/${currentPhase.phase}` : "/(tabs)/journey")}
            style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrow}>Continue your journey</Text>
              <Text style={styles.actionTitle}>{currentPhase?.title ?? "Begin"}</Text>
              <Text style={styles.actionSub}>{currentPhase?.subtitle ?? "The first quiet steps."}</Text>
            </View>
            <Feather name="arrow-right" size={20} color={colors.onBrandPrimary} />
          </Pressable>

          <Pressable
            testID="today-journal-button"
            onPress={() => router.push("/journal-entry")}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrowLight}>Journal</Text>
              <Text style={styles.actionTitleLight}>Write, softly.</Text>
            </View>
            <Feather name="edit-3" size={18} color={colors.onSurface} />
          </Pressable>

          <Pressable
            testID="today-reflection-button"
            onPress={() => router.push("/checkin")}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrowLight}>Today's reflection</Text>
              <Text style={styles.actionTitleLight}>A weekly check-in.</Text>
            </View>
            <Feather name="feather" size={18} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Quiet secondary access — safety net always within reach */}
        <View style={styles.quietRow}>
          <Pressable onPress={() => router.push("/safety")} testID="today-safety-button" style={styles.quietBtn}>
            <Feather name="shield" size={14} color={colors.onSurfaceSecondary} />
            <Text style={styles.quietText}>Safety net</Text>
          </Pressable>
          <View style={styles.quietDot} />
          <Pressable onPress={() => router.push("/find-therapist")} testID="today-therapist-button" style={styles.quietBtn}>
            <Feather name="user-check" size={14} color={colors.onSurfaceSecondary} />
            <Text style={styles.quietText}>Find a therapist</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  iconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  appTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "500", letterSpacing: 0.3 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  // Editorial masthead
  masthead: { marginBottom: spacing.xl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase" },
  greet: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: colors.onSurface, fontWeight: "500", marginTop: spacing.md },
  affirm: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.brandPrimary, fontStyle: "italic", marginTop: spacing.sm },

  // Living sanctuary panel
  sanctuary: { height: 200, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.xl, backgroundColor: colors.surfaceTertiary, position: "relative" },
  sky: { position: "absolute", top: 0, left: 0, right: 0, height: 140, backgroundColor: "#D9D2C4" },
  horizon: { position: "absolute", top: 130, left: 0, right: 0, height: 1, backgroundColor: colors.brandSecondary },
  sun: { position: "absolute", top: 24, right: 32, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent },
  groundLine: { position: "absolute", bottom: 0, left: 0, right: 0, height: 60, backgroundColor: colors.brandTertiary },
  trunk: { position: "absolute", bottom: 40, left: "50%", width: 4, marginLeft: -2, backgroundColor: "#6B4E3A", borderRadius: 2 },
  canopy: { position: "absolute", bottom: 80, left: "50%", width: 60, height: 60, marginLeft: -30, borderRadius: 30, backgroundColor: colors.brandPrimary },
  stone: { position: "absolute", width: 14, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  flower: { position: "absolute", bottom: 26, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  sanctuaryFooter: { position: "absolute", bottom: spacing.md, left: spacing.lg, right: spacing.lg },
  sanctuaryPct: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500" },
  sanctuaryMeta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },

  // Three primary actions
  actions: { gap: spacing.md },
  actionPrimary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, padding: spacing.xl, borderRadius: radius.md, minHeight: 100 },
  pressed: { opacity: 0.9 },
  actionEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.brandTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  actionTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onBrandPrimary, fontWeight: "500" },
  actionSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.brandTertiary, marginTop: 4 },
  actionSecondary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radius.md, minHeight: 72 },
  actionEyebrowLight: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.xs },
  actionTitleLight: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurface, fontWeight: "500" },

  // Quiet row
  quietRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  quietBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  quietText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  quietDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.borderStrong },
});
