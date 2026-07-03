import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

// Journal — the writing space. Feels like the index page of a hardcover
// notebook. No tabs. No FAB. Nothing that looks like software.

function monthGroup(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function JournalScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await api.listJournal();
      setEntries(j);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openNew = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/journal-entry");
  };

  // Group entries by month.
  const grouped: { key: string; entries: any[] }[] = [];
  entries.forEach((e) => {
    const key = monthGroup(new Date(e.created_at));
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else grouped.push({ key, entries: [e] });
  });

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="vault-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="journal-back-button">
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View />
        <Pressable onPress={openNew} style={styles.iconBtn} testID="journal-new-button">
          <Feather name="edit-3" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>A quiet archive</Text>
        <Text style={styles.title}>Journal</Text>
        <Text style={styles.subtitle}>
          Everything written here is yours alone. Return whenever you need to.
        </Text>

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyLine}>The first page is always the quietest.</Text>
            <Pressable onPress={openNew} style={styles.beginBtn} testID="journal-begin-button">
              <Text style={styles.beginText}>Begin an entry</Text>
              <Feather name="arrow-right" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        ) : (
          grouped.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text style={styles.groupLabel}>{g.key}</Text>
              {g.entries.map((e) => {
                const d = new Date(e.created_at);
                return (
                  <Pressable
                    key={e.entry_id}
                    onPress={() => router.push(`/journal-entry?id=${e.entry_id}`)}
                    style={({ pressed }) => [styles.entryRow, pressed && styles.entryPressed]}
                    testID={`journal-entry-${e.entry_id}`}
                  >
                    <View style={styles.entryHead}>
                      <Text style={styles.entryDay}>{d.getDate()}</Text>
                      <View style={{ flex: 1, marginLeft: spacing.lg }}>
                        {e.title ? <Text style={styles.entryTitle} numberOfLines={1}>{e.title}</Text> : null}
                        <Text style={styles.entryBody} numberOfLines={2}>{e.body}</Text>
                        {e.mood_word ? (
                          <Text style={styles.entryMood}>{e.mood_word.toLowerCase()}</Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  title: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 50, color: colors.onSurface, fontWeight: "500" },
  subtitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontStyle: "italic", marginTop: spacing.md, marginBottom: spacing.xxl, lineHeight: 26 },

  empty: { paddingVertical: spacing.xxl, alignItems: "flex-start" },
  emptyLine: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontStyle: "italic", marginBottom: spacing.xl, lineHeight: 26 },
  beginBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  beginText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, letterSpacing: 0.3, fontWeight: "500" },

  group: { marginBottom: spacing.xl },
  groupLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  entryRow: { paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  entryPressed: { opacity: 0.6 },
  entryHead: { flexDirection: "row", alignItems: "flex-start" },
  entryDay: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onSurface, fontWeight: "500", width: 40, textAlign: "right" },
  entryTitle: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurface, fontWeight: "500", marginBottom: 4 },
  entryBody: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 22 },
  entryMood: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.brandPrimary, fontStyle: "italic", marginTop: 6, letterSpacing: 0.5 },
});
