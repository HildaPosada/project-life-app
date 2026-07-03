import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

// Profile — a personal sanctuary, not a settings page.
// Your journey at the top; settings organized into calm sections.

type Section = {
  key: string;
  label: string;
  items: {
    key: string;
    title: string;
    icon: any;
    subtitle?: string;
    route?: string;
    onPress?: () => void;
    tone?: "default" | "danger";
  }[];
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dash, setDash] = useState<any | null>(null);
  const [stones, setStones] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, m, p] = await Promise.all([
        api.dashboard(),
        api.memoryPath(),
        api.listPhases(),
      ]);
      setDash(d);
      setStones(m?.stones ?? []);
      setPhases(p);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const firstName = user?.name?.split(" ")[0] ?? "friend";
  const initial = firstName.charAt(0).toUpperCase();
  const currentPhase = phases.find((p) => p.is_current);
  const seasonName = currentPhase?.title ?? "Groundwork";
  const activeDays = dash?.context?.active_days_count ?? 0;
  const stoneCount = stones.length;
  const latestStone = stones[stones.length - 1];

  const openStone = (s: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/memory/${s.stone_id}`);
  };

  const sections: Section[] = [
    {
      key: "care",
      label: "Care",
      items: [
        { key: "safety", title: "Safety net", icon: "shield", subtitle: "Contacts & crisis resources", route: "/safety" },
        { key: "therapist", title: "Find a therapist", icon: "user-check", subtitle: "A gentle guide", route: "/find-therapist" },
      ],
    },
    {
      key: "practice",
      label: "Practice",
      items: [
        { key: "practices", title: "Practices library", icon: "feather", subtitle: "Somatic & grounding", route: "/(tabs)/library" },
        { key: "journey", title: "Healing journey", icon: "compass", subtitle: "Four seasons", route: "/(tabs)/journey" },
      ],
    },
    {
      key: "account",
      label: "Account",
      items: [
        { key: "privacy", title: "Privacy", icon: "lock", subtitle: "Everything you write is yours" },
        { key: "membership", title: "Membership", icon: "star", subtitle: "Manage subscription" },
        { key: "signout", title: "Sign out", icon: "log-out", tone: "danger", onPress: logout },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="profile-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="profile-back-button">
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View />
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Journey masthead — no numbers, just presence */}
        <View style={styles.masthead}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.journeyCard}>
          <Text style={styles.jEyebrow}>Where you are</Text>
          <Text style={styles.jTitle}>{seasonName}</Text>
          <Text style={styles.jMeta}>
            {activeDays === 0
              ? "your first pages"
              : activeDays === 1
              ? "one day of showing up"
              : `${activeDays} days of showing up`}
            {stoneCount > 0 ? ` · ${stoneCount} ${stoneCount === 1 ? "stone" : "stones"} on the path` : ""}
          </Text>
        </View>

        {/* Memory preview — the sanctuary's newest chapter */}
        {latestStone && (
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Recent memory</Text>
            <Pressable
              onPress={() => openStone(latestStone)}
              style={({ pressed }) => [styles.memoryCard, pressed && styles.pressed]}
              testID={`profile-latest-stone-${latestStone.stone_id}`}
            >
              <View style={styles.stoneDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.memoryTitle}>{latestStone.title}</Text>
                <Text style={styles.memoryPreview} numberOfLines={2}>
                  {latestStone.preview || "A chapter, quietly placed."}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.onSurfaceTertiary} />
            </Pressable>
            {stoneCount > 1 && (
              <Text style={styles.moreStones}>
                {stoneCount - 1} more {stoneCount - 1 === 1 ? "stone rests" : "stones rest"} along the path.
              </Text>
            )}
          </View>
        )}

        {/* Sections */}
        {sections.map((s) => (
          <View key={s.key} style={styles.block}>
            <Text style={styles.blockLabel}>{s.label}</Text>
            {s.items.map((it, idx) => (
              <Pressable
                key={it.key}
                onPress={() => {
                  if (it.onPress) it.onPress();
                  else if (it.route) router.push(it.route as any);
                }}
                style={({ pressed }) => [
                  styles.row,
                  idx === 0 && styles.rowFirst,
                  pressed && styles.pressed,
                ]}
                testID={`profile-item-${it.key}`}
              >
                <Feather name={it.icon} size={18} color={it.tone === "danger" ? colors.error : colors.onSurface} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[styles.rowTitle, it.tone === "danger" && { color: colors.error }]}>{it.title}</Text>
                  {it.subtitle ? <Text style={styles.rowSub}>{it.subtitle}</Text> : null}
                </View>
                {it.tone !== "danger" && (
                  <Feather name="chevron-right" size={16} color={colors.onSurfaceTertiary} />
                )}
              </Pressable>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>Project Life — a sanctuary for healing.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  masthead: { alignItems: "center", paddingVertical: spacing.xl },
  avatarLarge: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  avatarInitial: { fontFamily: fonts.serif, fontSize: 32, color: colors.onBrandPrimary, fontWeight: "500" },
  name: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onSurface, fontWeight: "500" },
  email: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 4 },

  journeyCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.xl, borderRadius: radius.md, marginTop: spacing.md, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border },
  jEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  jTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onSurface, fontWeight: "500" },
  jMeta: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontStyle: "italic", marginTop: spacing.sm },

  block: { marginBottom: spacing.xxl },
  blockLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  pressed: { opacity: 0.7 },

  memoryCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  stoneDot: { width: 12, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  memoryTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "500" },
  memoryPreview: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 4, lineHeight: 20 },
  moreStones: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, fontStyle: "italic", marginTop: spacing.sm },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  rowFirst: { borderTopWidth: 1 },
  rowTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "500" },
  rowSub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },

  footer: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", fontStyle: "italic", marginTop: spacing.xl },
});
