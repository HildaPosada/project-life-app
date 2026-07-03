import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

const MOOD_LABELS = ["Heavy", "Tender", "Steady", "Open", "Bright"];

export default function CheckinScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [themes, setThemes] = useState("");
  const [mood, setMood] = useState(3);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await api.createWeeklyCheckin({ feeling_summary: summary, themes: themes || undefined, mood_score: mood });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="checkin-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="checkin-close-button" style={styles.close}>
            <Feather name="x" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>Weekly reflection</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>How are you feeling this week?</Text>
          <TextInput
            testID="checkin-summary-input"
            value={summary}
            onChangeText={setSummary}
            placeholder="Take your time. A sentence is enough."
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={styles.label}>Themes you noticed</Text>
          <TextInput
            testID="checkin-themes-input"
            value={themes}
            onChangeText={setThemes}
            placeholder="e.g., boundaries, grief, tenderness"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
          />

          <Text style={styles.label}>Overall mood</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                testID={`checkin-mood-${n}`}
                onPress={() => setMood(n)}
                style={[styles.moodDot, mood === n && styles.moodDotActive]}
              >
                <Text style={[styles.moodNum, mood === n && styles.moodNumActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.moodLabel}>{MOOD_LABELS[mood - 1]}</Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="checkin-save-button"
            onPress={submit}
            disabled={saving || !summary.trim()}
            style={[styles.primary, (!summary.trim() || saving) && styles.primaryDisabled]}
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Feather name="check" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Save reflection</Text>
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
  label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, minHeight: 48 },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  moodDot: { flex: 1, aspectRatio: 1, borderRadius: 999, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginHorizontal: 4, borderWidth: 1, borderColor: colors.border },
  moodDotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  moodNum: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurfaceSecondary },
  moodNumActive: { color: colors.onBrandPrimary },
  moodLabel: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill, minHeight: 52 },
  primaryDisabled: { backgroundColor: colors.surfaceTertiary },
  primaryText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onBrandPrimary, fontWeight: "500" },
});
