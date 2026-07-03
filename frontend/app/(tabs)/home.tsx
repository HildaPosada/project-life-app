import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

const PHASE_LABELS = ["Groundwork", "Talk Therapy", "EMDR", "Somatic Integration"];

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [phases, setPhases] = useState<any[]>([]);
  const [todaySafe, setTodaySafe] = useState<any | null>(null);
  const [insights, setInsights] = useState<any>({ entry_count: 0, weekly_checkins: 0, therapist_uploads: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, i] = await Promise.all([
        api.listPhases(),
        api.todaySafetyCheckin().catch(() => null),
        api.journalInsights().catch(() => ({ entry_count: 0, weekly_checkins: 0, therapist_uploads: 0 })),
      ]);
      setPhases(p);
      setTodaySafe(s);
      setInsights(i);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const currentPhase = phases.find((p) => p.is_current) ?? phases[0];
  const phaseIdx = user?.current_phase ?? 0;

  const openSafety = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/safety");
  };

  return (
    <View style={styles.root} testID="home-screen">
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1605187151664-9d89904d62d0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwzfHx3YXJtJTIwam91cm5hbGluZyUyMGFlc3RoZXRpYyUyMG5vdGVib29rJTIwY29mZmVlfGVufDB8fHx8MTc4MzA2NjMxN3ww&ixlib=rb-4.1.0&q=85" }}
        style={styles.heroImg}
      />
      <LinearGradient colors={["rgba(249,248,245,0)", colors.surface]} style={styles.heroScrim} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.topRow}>
            <View>
              <Text style={styles.hi}>Hello, {user?.name?.split(" ")[0] ?? "friend"}.</Text>
              <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
            </View>
            <Pressable onPress={logout} testID="home-logout-button" style={styles.iconBtn}>
              <Feather name="log-out" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <Pressable
            testID="home-safety-check-button"
            onPress={openSafety}
            style={styles.safetyCard}
          >
            <View style={styles.safetyLeft}>
              <View style={styles.safetyIcon}>
                <Feather name="shield" size={20} color={colors.onBrandSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyTitle}>Do you feel safe today?</Text>
                <Text style={styles.safetySub}>
                  {todaySafe ? (todaySafe.feel_safe ? "Answered: yes, resourced." : "Answered: needs care.") : "A quiet check-in, only for you."}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>

          {currentPhase && (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>Current Phase</Text>
              <Text style={styles.cardTitle}>{currentPhase.title}</Text>
              <Text style={styles.cardSub}>{currentPhase.subtitle} · {currentPhase.duration}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${currentPhase.progress_pct}%` }]} />
              </View>
              <Text style={styles.progressText}>{currentPhase.progress_pct}% along</Text>
              <View style={styles.reqs}>
                {currentPhase.requirements.map((r: string) => (
                  <View key={r} style={styles.reqRow}>
                    <Feather name="circle" size={12} color={colors.brandPrimary} />
                    <Text style={styles.reqText}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Today&apos;s gentle steps</Text>

          <Pressable
            testID="home-weekly-checkin-button"
            onPress={() => router.push("/checkin")}
            style={styles.actionCard}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.brandTertiary }]}>
              <Feather name="edit-3" size={18} color={colors.onBrandTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Weekly reflection</Text>
              <Text style={styles.actionSub}>How are you feeling? Any themes this week?</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.onSurfaceTertiary} />
          </Pressable>

          <Pressable
            testID="home-new-journal-button"
            onPress={() => router.push("/journal-entry")}
            style={styles.actionCard}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.surfaceTertiary }]}>
              <Feather name="book-open" size={18} color={colors.onBrandTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Journal entry</Text>
              <Text style={styles.actionSub}>Encrypted, private, and quiet.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.onSurfaceTertiary} />
          </Pressable>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{insights.entry_count}</Text>
              <Text style={styles.statLabel}>Entries</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{insights.weekly_checkins}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>Phase {phaseIdx}</Text>
              <Text style={styles.statLabel}>{PHASE_LABELS[phaseIdx]}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  heroScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xl },
  hi: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  date: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  safetyCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border },
  safetyLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.md },
  safetyIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  safetyTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface },
  safetySub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border },
  cardEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm },
  cardTitle: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface, marginBottom: spacing.xs },
  cardSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.lg },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brandPrimary, borderRadius: 3 },
  progressText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.md },
  reqs: { gap: spacing.sm, marginTop: spacing.sm },
  reqRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reqText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.md },
  actionCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  actionIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface },
  actionSub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  statRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  statCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statNum: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface },
  statLabel: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2, textAlign: "center" },
});
