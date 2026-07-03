import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

const MOOD_WORDS = ["Heavy", "Tender", "Anxious", "Grounded", "Open", "Grateful", "Hopeful", "Numb", "Steady", "Tired"];

export default function JournalEntryScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moodWord, setMoodWord] = useState<string | null>(null);
  const [moodScore, setMoodScore] = useState(3);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.createJournal({
        title: title || undefined,
        body,
        mood_word: moodWord ?? undefined,
        mood_score: moodScore,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="journal-entry-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="journal-close-button" style={styles.close}>
            <Feather name="x" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>New entry</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            testID="journal-title-input"
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.titleInput}
          />
          <TextInput
            testID="journal-body-input"
            value={body}
            onChangeText={setBody}
            placeholder="Nothing here is judged. Write freely."
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>A word for how it felt</Text>
          <View style={styles.wordRow}>
            {MOOD_WORDS.map((w) => (
              <Pressable
                key={w}
                testID={`journal-mood-word-${w}`}
                onPress={() => setMoodWord(moodWord === w ? null : w)}
                style={[styles.wordChip, moodWord === w && styles.wordChipActive]}
              >
                <Text style={[styles.wordText, moodWord === w && styles.wordTextActive]}>{w}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Overall mood ({moodScore})</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                testID={`journal-mood-${n}`}
                onPress={() => setMoodScore(n)}
                style={[styles.moodDot, moodScore === n && styles.moodDotActive]}
              >
                <Text style={[styles.moodNum, moodScore === n && styles.moodNumActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="journal-save-button"
            onPress={save}
            disabled={saving || !body.trim()}
            style={[styles.primary, (!body.trim() || saving) && styles.primaryDisabled]}
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Feather name="check" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Save entry</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  close: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  titleInput: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: spacing.md, marginBottom: spacing.md },
  bodyInput: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurface, lineHeight: 26, minHeight: 200, paddingVertical: spacing.md },
  label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  wordRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wordChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  wordChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  wordText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface },
  wordTextActive: { color: colors.onBrandPrimary },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  moodDot: { flex: 1, aspectRatio: 1, borderRadius: 999, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginHorizontal: 4, borderWidth: 1, borderColor: colors.border },
  moodDotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  moodNum: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurfaceSecondary },
  moodNumActive: { color: colors.onBrandPrimary },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill, minHeight: 52 },
  primaryDisabled: { backgroundColor: colors.surfaceTertiary },
  primaryText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onBrandPrimary, fontWeight: "500" },
});
