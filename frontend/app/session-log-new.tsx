import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

const TYPES: { key: string; label: string }[] = [
  { key: "therapy", label: "Therapy" },
  { key: "somatic", label: "Somatic" },
  { key: "ketamine", label: "Ketamine" },
  { key: "other", label: "Other" },
];

export default function SessionLogNewScreen() {
  const router = useRouter();
  const [type, setType] = useState<string>("therapy");
  const [body, setBody] = useState("");
  const [insights, setInsights] = useState("");
  const [integration, setIntegration] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.createSessionLog({
        session_type: type as any,
        body_experience: body || undefined,
        insights: insights || undefined,
        integration_notes: integration || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="session-log-new-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="sl-close-button" style={styles.close}>
            <Feather name="x" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>Integration log</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Session type</Text>
          <View style={styles.chipRow}>
            {TYPES.map((t) => (
              <Pressable
                key={t.key}
                testID={`sl-type-${t.key}`}
                onPress={() => setType(t.key)}
                style={[styles.chip, type === t.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, type === t.key && styles.chipTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Body-based experience</Text>
          <TextInput
            testID="sl-body-input"
            value={body}
            onChangeText={setBody}
            placeholder="What did you notice in the body?"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={styles.label}>Insights</Text>
          <TextInput
            testID="sl-insights-input"
            value={insights}
            onChangeText={setInsights}
            placeholder="Anything that surfaced or clarified"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={styles.label}>Integration notes</Text>
          <TextInput
            testID="sl-integration-input"
            value={integration}
            onChangeText={setIntegration}
            placeholder="How will you move forward this week?"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, styles.textArea]}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="sl-save-button"
            onPress={save}
            disabled={saving}
            style={[styles.primary, saving && styles.primaryDisabled]}
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Feather name="check" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Save log</Text>
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
  textArea: { minHeight: 100, textAlignVertical: "top" },
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
