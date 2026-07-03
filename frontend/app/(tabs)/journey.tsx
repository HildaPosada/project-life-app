import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

export default function JourneyScreen() {
  const router = useRouter();
  const [phases, setPhases] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([api.listPhases(), api.listTimeline()]);
      setPhases(p);
      setEvents(e);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root} testID="journey-screen">
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1629106279285-a56fded8cda8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwbmF0dXJlJTIwYWVzdGhldGljJTIwZm9yZXN0JTIwc29mdCUyMGxpZ2h0fGVufDB8fHx8MTc4MzA2NjMxN3ww&ixlib=rb-4.1.0&q=85" }}
        style={styles.hero}
      />
      <LinearGradient colors={["rgba(249,248,245,0.6)", "rgba(249,248,245,0.95)", colors.surface]} style={styles.scrim} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Your journey</Text>
          <Text style={styles.sub}>A 2.2-year unhurried arc.</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.timeline}>
            {phases.map((p, idx) => (
              <Pressable
                key={p.phase}
                testID={`phase-node-${p.phase}`}
                onPress={() => router.push(`/phase/${p.phase}`)}
                style={styles.node}
              >
                <View style={styles.nodeLine}>
                  <View style={[styles.dot, p.is_unlocked ? styles.dotUnlocked : styles.dotLocked, p.is_current && styles.dotCurrent]}>
                    {p.is_unlocked ? (
                      <Feather name={p.is_current ? "circle" : "check"} size={12} color={colors.onBrandPrimary} />
                    ) : (
                      <Feather name="lock" size={10} color={colors.onSurfaceTertiary} />
                    )}
                  </View>
                  {idx < phases.length - 1 && <View style={[styles.line, p.is_unlocked && styles.lineActive]} />}
                </View>
                <View style={[styles.nodeCard, !p.is_unlocked && styles.nodeCardLocked]}>
                  <Text style={styles.nodeEyebrow}>Phase {p.phase} · {p.duration}</Text>
                  <Text style={styles.nodeTitle}>{p.title}</Text>
                  <Text style={styles.nodeSub}>{p.subtitle}</Text>
                  {p.is_unlocked && (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${p.progress_pct}%` }]} />
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Trauma Map events</Text>
          <Text style={styles.sectionSub}>Landmarks to bring into therapy conversations.</Text>

          {events.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="map-pin" size={24} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>No events yet. Add moments, insights, or shifts to visualize your path.</Text>
            </View>
          ) : (
            events.map((e) => (
              <View key={e.event_id} style={styles.eventCard} testID={`timeline-event-${e.event_id}`}>
                <Text style={styles.eventDate}>{new Date(e.event_date).toLocaleDateString()}</Text>
                <Text style={styles.eventTitle}>{e.title}</Text>
                {e.emotion ? <Text style={styles.eventChip}>{e.emotion}</Text> : null}
                {e.insight ? <Text style={styles.eventInsight}>{e.insight}</Text> : null}
              </View>
            ))
          )}

          <Pressable
            testID="add-timeline-event-button"
            onPress={() => router.push("/timeline-new")}
            style={styles.addBtn}
          >
            <Feather name="plus" size={16} color={colors.brandPrimary} />
            <Text style={styles.addBtnText}>Add a landmark</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 2 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  timeline: { marginTop: spacing.md },
  node: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  nodeLine: { alignItems: "center", width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  dotUnlocked: { backgroundColor: colors.brandPrimary },
  dotLocked: { backgroundColor: colors.surfaceTertiary },
  dotCurrent: { backgroundColor: colors.brandSecondary },
  line: { width: 2, flex: 1, backgroundColor: colors.surfaceTertiary, marginTop: 4, minHeight: 40 },
  lineActive: { backgroundColor: colors.brandTertiary },
  nodeCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  nodeCardLocked: { opacity: 0.55 },
  nodeEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs },
  nodeTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface },
  nodeSub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2, marginBottom: spacing.sm },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceTertiary, marginTop: spacing.sm, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: colors.brandPrimary },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginTop: spacing.xxl, marginBottom: spacing.xs },
  sectionSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, textAlign: "center" },
  eventCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  eventDate: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.xs },
  eventTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface },
  eventChip: { alignSelf: "flex-start", backgroundColor: colors.brandTertiary, color: colors.onBrandTertiary, paddingHorizontal: spacing.md, paddingVertical: 2, borderRadius: radius.pill, marginTop: spacing.sm, fontSize: fontSize.xs, fontFamily: fonts.body },
  eventInsight: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: spacing.sm, lineHeight: 22 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  addBtnText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.brandPrimary },
});
