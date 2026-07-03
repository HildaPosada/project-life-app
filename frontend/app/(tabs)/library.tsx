import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useEntitlement } from "@/src/context/EntitlementContext";
import { PremiumGate } from "@/src/components/PremiumGate";

const CATEGORY_ICON: Record<string, string> = {
  "Breathing": "wind",
  "Grounding": "anchor",
  "Body Awareness": "activity",
  "EMDR pre-work": "eye",
};

export default function LibraryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useEntitlement();
  const [practices, setPractices] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string>("All");

  const load = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([api.listPractices(), api.listUploads()]);
      setPractices(p);
      setUploads(u);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const categories = ["All", ...Array.from(new Set(practices.map((p) => p.category)))];
  const filtered = activeCat === "All" ? practices : practices.filter((p) => p.category === activeCat);
  const currentPhase = user?.current_phase ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="library-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Practices</Text>
        <Text style={styles.sub}>Somatic, grounding, and therapist uploads.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {isPremium ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRowInner}
              style={styles.chipScroll}
            >
              {categories.map((c) => (
                <Pressable
                  key={c}
                  testID={`library-chip-${c}`}
                  onPress={() => setActiveCat(c)}
                  style={[styles.chip, activeCat === c && styles.chipActive]}
                >
                  <Text style={[styles.chipText, activeCat === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {filtered.map((p) => {
              const locked = p.unlock_phase > currentPhase;
              return (
                <View key={p.practice_id} style={[styles.practice, locked && styles.practiceLocked]} testID={`practice-${p.practice_id}`}>
                  <View style={styles.pIcon}>
                    <Feather
                      name={(CATEGORY_ICON[p.category] as any) ?? "circle"}
                      size={18}
                      color={colors.onBrandTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.pTop}>
                      <Text style={styles.pTitle}>{p.title}</Text>
                      {locked ? <Feather name="lock" size={14} color={colors.onSurfaceTertiary} /> : null}
                    </View>
                    <Text style={styles.pMeta}>{p.category} · {p.duration_min} min</Text>
                    <Text style={styles.pDesc} numberOfLines={2}>{p.description}</Text>
                    {locked && <Text style={styles.pLock}>Unlocks in Phase {p.unlock_phase}</Text>}
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <PremiumGate
            eyebrow="Practices"
            title="The full library opens with Premium."
            body="Somatic exercises, breathing patterns, grounding practices, and EMDR pre-work — a growing library, tended slowly, available whenever you need to return to the body."
            cta="See what unfolds"
          />
        )}

        <View style={styles.uploadsBlock}>
          <View style={styles.uploadsHead}>
            <Text style={styles.sectionTitle}>Therapist uploads</Text>
            <Pressable
              testID="library-add-upload-button"
              onPress={() => router.push("/upload-new")}
              style={styles.smallBtn}
            >
              <Feather name="plus" size={14} color={colors.brandPrimary} />
              <Text style={styles.smallBtnText}>Add</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionSub}>Weekly summaries, release forms, or EMDR approval.</Text>

          {uploads.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="upload" size={20} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>No uploads yet. Add a therapist summary to unlock milestones.</Text>
            </View>
          ) : (
            uploads.map((u) => (
              <View key={u.upload_id} style={styles.uploadCard} testID={`upload-${u.upload_id}`}>
                <Feather name="file-text" size={18} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadTitle}>{u.filename}</Text>
                  <Text style={styles.uploadMeta}>{u.kind.replace("_", " ")} · {new Date(u.created_at).toLocaleDateString()}</Text>
                  {u.notes ? <Text style={styles.uploadNotes} numberOfLines={2}>{u.notes}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 2 },
  chipScroll: { maxHeight: 56 },
  chipsRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md, alignItems: "center" },
  chipsRowInner: { gap: spacing.sm, paddingVertical: spacing.md, alignItems: "center", marginBottom: spacing.sm },
  chip: { flexShrink: 0, paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, height: 36, justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface },
  chipTextActive: { color: colors.onBrandPrimary },
  body: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  practice: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  practiceLocked: { opacity: 0.55 },
  pIcon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  pTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface },
  pMeta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  pDesc: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: spacing.sm, lineHeight: 20 },
  pLock: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.warning, marginTop: spacing.sm },
  uploadsBlock: { marginTop: spacing.xl },
  uploadsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface },
  sectionSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 2, marginBottom: spacing.md },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  smallBtnText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.brandPrimary },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, textAlign: "center" },
  uploadCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  uploadTitle: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.onSurface },
  uploadMeta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  uploadNotes: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: spacing.xs },
});
