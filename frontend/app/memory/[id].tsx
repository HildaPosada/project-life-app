import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

// Memory Stone detail — revisit a chapter from the user's own history.
// Never shows a "badge"; only the moment itself.

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [stone, setStone] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.memoryStone(String(id));
        setStone(s);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} testID="memory-loading">
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  if (!stone) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.appbar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.miss}>This chapter has faded.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const entry = stone.entry;
  const dateStr = new Date(stone.date + "T12:00:00Z").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="memory-detail-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="memory-back-button">
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>A memory</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>{dateStr}</Text>
        <Text style={styles.title}>{stone.title}</Text>

        <View style={styles.divider} />

        {stone.kind === "journal" && entry ? (
          <View>
            {entry.title ? <Text style={styles.entryTitle}>{entry.title}</Text> : null}
            {entry.mood_word ? (
              <View style={styles.moodPill}>
                <Text style={styles.moodPillText}>{entry.mood_word}</Text>
              </View>
            ) : null}
            <Text style={styles.body}>{entry.body}</Text>
          </View>
        ) : null}

        {stone.kind === "checkin" && entry ? (
          <View>
            <Text style={styles.entryTitle}>{entry.feeling_summary}</Text>
            {entry.themes ? (
              <Text style={styles.body}>Themes: {entry.themes}</Text>
            ) : null}
            <View style={styles.moodPill}>
              <Text style={styles.moodPillText}>mood · {entry.mood_score}/5</Text>
            </View>
          </View>
        ) : null}

        {stone.kind === "phase" ? (
          <View>
            <Text style={styles.body}>A new season began — Season {entry?.phase}.</Text>
            <Text style={styles.italic}>Every season leaves a stone on the path.</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>This stone was placed on the sanctuary path when this chapter began.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  iconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  appTitle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "500" },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  title: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: colors.onSurface, fontWeight: "500" },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xl },
  entryTitle: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.md, fontWeight: "500" },
  body: { fontFamily: fonts.body, fontSize: fontSize.lg, lineHeight: 28, color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  italic: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurfaceTertiary, fontStyle: "italic", marginTop: spacing.sm },
  moodPill: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginBottom: spacing.md },
  moodPillText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, letterSpacing: 0.5 },
  footer: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, fontStyle: "italic", marginTop: spacing.xxl, textAlign: "center", lineHeight: 22 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  miss: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurfaceSecondary, fontStyle: "italic" },
});
