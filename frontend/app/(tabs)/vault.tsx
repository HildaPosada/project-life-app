import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

type Tab = "journal" | "insights";

export default function VaultScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("journal");
  const [entries, setEntries] = useState<any[]>([]);
  const [insights, setInsights] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [j, i] = await Promise.all([api.listJournal(), api.journalInsights()]);
      setEntries(j);
      setInsights(i);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="vault-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Vault</Text>
        <Text style={styles.sub}>Your private space. Only you.</Text>
      </View>

      <View style={styles.segRow}>
        <Pressable
          testID="vault-tab-journal"
          onPress={() => setTab("journal")}
          style={[styles.seg, tab === "journal" && styles.segActive]}
        >
          <Text style={[styles.segText, tab === "journal" && styles.segTextActive]}>Journal</Text>
        </Pressable>
        <Pressable
          testID="vault-tab-insights"
          onPress={() => setTab("insights")}
          style={[styles.seg, tab === "insights" && styles.segActive]}
        >
          <Text style={[styles.segText, tab === "insights" && styles.segTextActive]}>Insights</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {tab === "journal" && (
          <>
            {entries.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="book" size={28} color={colors.onSurfaceTertiary} />
                <Text style={styles.emptyTitle}>Your private space awaits.</Text>
                <Text style={styles.emptySub}>Tap to log your first thought.</Text>
              </View>
            ) : (
              entries.map((e) => (
                <View key={e.entry_id} style={styles.entry} testID={`vault-entry-${e.entry_id}`}>
                  <View style={styles.entryHead}>
                    <Text style={styles.entryDate}>
                      {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                    {e.mood_word && (
                      <View style={styles.chip}><Text style={styles.chipText}>{e.mood_word}</Text></View>
                    )}
                  </View>
                  {e.title ? <Text style={styles.entryTitle}>{e.title}</Text> : null}
                  <Text style={styles.entryBody} numberOfLines={4}>{e.body}</Text>
                </View>
              ))
            )}
          </>
        )}

        {tab === "insights" && insights && (
          <View>
            <View style={styles.insightRow}>
              <View style={styles.insightCard}>
                <Text style={styles.insightNum}>{insights.entry_count}</Text>
                <Text style={styles.insightLabel}>Journal entries</Text>
              </View>
              <View style={styles.insightCard}>
                <Text style={styles.insightNum}>{insights.avg_mood ?? "—"}</Text>
                <Text style={styles.insightLabel}>Avg mood</Text>
              </View>
            </View>
            <View style={styles.insightRow}>
              <View style={styles.insightCard}>
                <Text style={styles.insightNum}>{insights.weekly_checkins}</Text>
                <Text style={styles.insightLabel}>Weekly check-ins</Text>
              </View>
              <View style={styles.insightCard}>
                <Text style={styles.insightNum}>{insights.therapist_uploads}</Text>
                <Text style={styles.insightLabel}>Therapist uploads</Text>
              </View>
            </View>
            <Text style={styles.insightTitle}>Emotional words</Text>
            {insights.top_words?.length ? (
              <View style={styles.wordCloud}>
                {insights.top_words.map((w: any) => (
                  <View key={w.word} style={styles.wordChip}>
                    <Text style={styles.wordText}>{w.word}</Text>
                    <Text style={styles.wordCount}>{w.count}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Add a mood word to your journal entries to see trends here.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <Pressable
        testID="vault-new-entry-fab"
        onPress={() => router.push("/journal-entry")}
        style={styles.fab}
      >
        <Feather name="plus" size={22} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>New entry</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 2 },
  segRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  seg: { paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  segActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  segText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface },
  segTextActive: { color: colors.onBrandPrimary },
  body: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  empty: { alignItems: "center", padding: spacing.xxl, marginTop: spacing.xl, gap: spacing.md },
  emptyTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, textAlign: "center" },
  emptySub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, textAlign: "center" },
  entry: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  entryDate: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  entryTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.xs },
  entryBody: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 22 },
  chip: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onBrandTertiary },
  insightRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  insightCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  insightNum: { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.onSurface },
  insightLabel: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  insightTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.md },
  wordCloud: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wordChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  wordText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface },
  wordCount: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  hint: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: spacing.md },
  fab: { position: "absolute", bottom: 96, right: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.pill },
  fabText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },
});
