import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

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

// Daily affirmation — soft, non-instructive, deterministic per-day so it
// doesn't feel random or gamified.
const AFFIRMATIONS = [
  "one step at a time",
  "the body remembers, and the body can rest",
  "you are already becoming",
  "slow is not the opposite of progress",
  "healing is a season, not a task",
  "your pace is the right pace",
  "return, gently, to what is here",
];
function pickAffirmation(): string {
  const d = new Date();
  const key = d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate();
  return AFFIRMATIONS[key % AFFIRMATIONS.length];
}

// Emotional (not numerical) reflection of this week's activity.
function weekSummary(count: number): string {
  if (count <= 0) return "A quiet week. That\u2019s alright.";
  if (count === 1) return "You showed up once this week.";
  if (count <= 3) return `You've shown up ${count} times this week.`;
  if (count <= 6) return "You're building a consistent practice.";
  return "You've been remarkably present this week.";
}

// Subtle staggered fade-in for a magazine-like reveal.
function useEntranceFade(steps: number, delayStep = 90) {
  const values = useRef(
    Array.from({ length: steps }, () => new Animated.Value(0)),
  ).current;
  useEffect(() => {
    Animated.stagger(
      delayStep,
      values.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [values, delayStep]);
  return values;
}

// Living sanctuary — a slow, non-gamified visualization that gains texture
// as the user tends to their practice. Growth is derived from *total*
// activity, not a percentage bar. No numbers on-screen.
function LivingSanctuary({ activity }: { activity: number }) {
  // We use log scaling so the earliest sessions are the most visible growth
  // and later ones plateau — healing curves are non-linear.
  const growth = Math.min(1, Math.log(1 + activity) / Math.log(1 + 24));
  const trunkH = 24 + growth * 46;
  const canopyScale = 0.55 + growth * 0.75;
  const sunOpacity = 0.35 + growth * 0.45;
  return (
    <View style={styles.sanctuary}>
      <LinearGradient
        colors={["#EFEAE1", "#E5D9C2", "#D9D2C4"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.sun, { opacity: sunOpacity }]} />
      <View style={styles.horizon} />
      <View style={styles.ground} />
      <View style={[styles.trunk, { height: trunkH }]} />
      <View style={[styles.canopy, { transform: [{ scale: canopyScale }] }]} />
      {activity >= 2 && <View style={[styles.stone, { left: "26%", bottom: 20 }]} />}
      {activity >= 4 && <View style={[styles.stone, { left: "70%", bottom: 24, transform: [{ scale: 0.9 }] }]} />}
      {activity >= 6 && <View style={[styles.stone, { left: "45%", bottom: 18, transform: [{ scale: 1.1 }] }]} />}
      {activity >= 8 && <View style={[styles.flower, { left: "32%" }]} />}
      {activity >= 12 && <View style={[styles.flower, { left: "62%" }]} />}
      {activity >= 16 && <View style={[styles.flower, { left: "50%" }]} />}
    </View>
  );
}

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dash, setDash] = useState<any | null>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const fades = useEntranceFade(6);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.dashboard(), api.listPhases()]);
      setDash(d);
      setPhases(p);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = user?.name?.split(" ")[0] ?? "friend";
  const affirmation = pickAffirmation();
  const currentPhase = phases.find((p) => p.is_current);
  const activityCount = dash?.sessions_completed ?? 0;
  const thisWeek = dash?.sessions_this_week ?? 0;
  const seasonName = currentPhase?.title ?? "Groundwork";

  const [f1, f2, f3, f4, f5, f6] = fades;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="today-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.push("/menu")} style={styles.iconBtn} testID="today-menu-button">
          <Feather name="menu" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Today</Text>
        <Pressable onPress={() => router.push("/menu")} style={styles.avatar} testID="today-avatar-button">
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Editorial masthead */}
        <Animated.View style={{ opacity: f1, transform: [{ translateY: f1.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          <View style={styles.masthead}>
            <Text style={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
            <Text style={styles.greet}>{timeGreeting()},{"\n"}{firstName}.</Text>
            <Text style={styles.affirm}>{affirmation}.</Text>
          </View>
        </Animated.View>

        {/* 2. Living sanctuary — the only visualization of growth */}
        <Animated.View style={{ opacity: f2, transform: [{ translateY: f2.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <LivingSanctuary activity={activityCount} />
          <Text style={styles.sanctuaryCaption}>Your sanctuary — {seasonName}</Text>
        </Animated.View>

        {/* 3. Three primary actions — nothing else competes */}
        <Animated.View style={{ opacity: f3, transform: [{ translateY: f3.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Pressable
            testID="today-continue-button"
            onPress={() => router.push(currentPhase ? `/phase/${currentPhase.phase}` : "/(tabs)/journey")}
            style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrow}>Continue your journey</Text>
              <Text style={styles.actionTitle}>{seasonName}</Text>
              <Text style={styles.actionSub}>Take one gentle step today.</Text>
            </View>
            <Feather name="arrow-right" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </Animated.View>

        <Animated.View style={{ opacity: f4, transform: [{ translateY: f4.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
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
        </Animated.View>

        <Animated.View style={{ opacity: f5, transform: [{ translateY: f5.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Pressable
            testID="today-reflection-button"
            onPress={() => router.push("/checkin")}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrowLight}>Today&rsquo;s reflection</Text>
              <Text style={styles.actionTitleLight}>A quiet weekly check-in.</Text>
            </View>
            <Feather name="feather" size={18} color={colors.onSurface} />
          </Pressable>
        </Animated.View>

        {/* 4. Emotional week summary — no numbers, just presence */}
        <Animated.View style={{ opacity: f6, transform: [{ translateY: f6.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Text style={styles.summary}>{weekSummary(thisWeek)}</Text>
        </Animated.View>

        {/* 5. Quiet row — safety and therapist support always within reach */}
        <Animated.View style={{ opacity: f6 }}>
          <View style={styles.quietRow}>
            <Pressable onPress={() => router.push("/safety")} testID="today-safety-button" style={styles.quietBtn}>
              <Text style={styles.quietText}>How are you feeling today?</Text>
              <Feather name="chevron-right" size={14} color={colors.onSurfaceTertiary} />
            </Pressable>
            <Pressable onPress={() => router.push("/find-therapist")} testID="today-therapist-button" style={styles.quietBtn}>
              <Text style={styles.quietText}>Find a therapist</Text>
              <Feather name="chevron-right" size={14} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  iconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  appTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "500", letterSpacing: 0.5 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  // 1. Editorial masthead
  masthead: { marginBottom: spacing.xxl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase" },
  greet: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.onSurface, fontWeight: "500", marginTop: spacing.md },
  affirm: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.brandPrimary, fontStyle: "italic", marginTop: spacing.md, lineHeight: 30 },

  // 2. Living sanctuary
  sanctuary: { height: 220, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.sm, position: "relative" },
  sun: { position: "absolute", top: 24, right: 32, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent },
  horizon: { position: "absolute", top: 138, left: 0, right: 0, height: 1, backgroundColor: colors.brandSecondary, opacity: 0.4 },
  ground: { position: "absolute", bottom: 0, left: 0, right: 0, height: 68, backgroundColor: colors.brandTertiary },
  trunk: { position: "absolute", bottom: 46, left: "50%", width: 4, marginLeft: -2, backgroundColor: "#6B4E3A", borderRadius: 2 },
  canopy: { position: "absolute", bottom: 92, left: "50%", width: 68, height: 68, marginLeft: -34, borderRadius: 34, backgroundColor: colors.brandPrimary },
  stone: { position: "absolute", width: 16, height: 9, borderRadius: 4, backgroundColor: colors.borderStrong },
  flower: { position: "absolute", bottom: 30, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  sanctuaryCaption: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", marginBottom: spacing.xxl, marginTop: spacing.md, letterSpacing: 0.5, fontStyle: "italic" },

  // 3. Actions
  pressed: { opacity: 0.88 },
  actionPrimary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, padding: spacing.xl, borderRadius: radius.md, minHeight: 108, marginBottom: spacing.md },
  actionEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.brandTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  actionTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onBrandPrimary, fontWeight: "500" },
  actionSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.brandTertiary, marginTop: 6, lineHeight: 20 },
  actionSecondary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radius.md, minHeight: 80, marginBottom: spacing.md },
  actionEyebrowLight: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.xs },
  actionTitleLight: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurface, fontWeight: "500" },

  // 4. Week summary
  summary: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.xl, marginBottom: spacing.lg, fontStyle: "italic", lineHeight: 26, paddingHorizontal: spacing.md },

  // 5. Quiet row
  quietRow: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  quietBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  quietText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
});
