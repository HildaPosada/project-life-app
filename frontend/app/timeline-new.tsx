import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

const EMOTIONS = ["Grief", "Anger", "Fear", "Joy", "Shame", "Love", "Peace", "Confusion"];

export default function TimelineNewScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [insight, setInsight] = useState("");
  const [emotion, setEmotion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createTimeline({ title, insight: insight || undefined, emotion: emotion ?? undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="timeline-new-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="timeline-close-button" style={styles.close}>
            <Feather name="x" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>New landmark</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>What happened or shifted?</Text>
          <TextInput
            testID="timeline-title-input"
            value={title}
            onChangeText={setTitle}
            placeholder="A moment, insight, or turning point"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
          />
          <Text style={styles.label}>Insight or context</Text>
          <TextInput
            testID="timeline-insight-input"
            value={insight}
            onChangeText={setInsight}
            placeholder="What did you notice? How did it feel?"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, styles.textArea]}
            multiline
          />
          <Text style={styles.label}>An emotion</Text>
          <View style={styles.chipRow}>
            {EMOTIONS.map((e) => (
              <Pressable
                key={e}
                testID={`timeline-emotion-${e}`}
                onPress={() => setEmotion(emotion === e ? null : e)}
                style={[styles.chip, emotion === e && styles.chipActive]}
              >
                <Text style={[styles.chipText, emotion === e && styles.chipTextActive]}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="timeline-save-button"
            onPress={save}
            disabled={saving || !title.trim()}
            style={[styles.primary, (!title.trim() || saving) && styles.primaryDisabled]}
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Feather name="check" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Save landmark</Text>
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface },
  chipTextActive: { color: colors.onBrandPrimary },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill, minHeight: 52 },
  primaryDisabled: { backgroundColor: colors.surfaceTertiary },
  primaryText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onBrandPrimary, fontWeight: "500" },
});
