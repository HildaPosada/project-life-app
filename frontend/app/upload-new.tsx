import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

const KINDS: { key: string; label: string }[] = [
  { key: "weekly_summary", label: "Weekly summary" },
  { key: "release_form", label: "Release form" },
  { key: "emdr_approval", label: "EMDR approval" },
  { key: "other", label: "Other" },
];

export default function UploadNewScreen() {
  const router = useRouter();
  const [filename, setFilename] = useState("");
  const [kind, setKind] = useState<string>("weekly_summary");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!filename.trim()) return;
    setSaving(true);
    try {
      await api.createUpload({ filename, kind: kind as any, notes: notes || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="upload-new-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="upload-close-button" style={styles.close}>
            <Feather name="x" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>Log therapist upload</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Record a summary or document reference from your therapist. File attachment coming soon — for now, log the reference and any notes.
          </Text>

          <Text style={styles.label}>Document name</Text>
          <TextInput
            testID="upload-filename-input"
            value={filename}
            onChangeText={setFilename}
            placeholder="e.g., Session summary — Sep 12"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
          />

          <Text style={styles.label}>Kind</Text>
          <View style={styles.chipRow}>
            {KINDS.map((k) => (
              <Pressable
                key={k.key}
                testID={`upload-kind-${k.key}`}
                onPress={() => setKind(k.key)}
                style={[styles.chip, kind === k.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, kind === k.key && styles.chipTextActive]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            testID="upload-notes-input"
            value={notes}
            onChangeText={setNotes}
            placeholder="Themes covered, homework, or next steps"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, styles.textArea]}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="upload-save-button"
            onPress={save}
            disabled={saving || !filename.trim()}
            style={[styles.primary, (!filename.trim() || saving) && styles.primaryDisabled]}
          >
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
              <>
                <Feather name="check" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>Save</Text>
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
  hint: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 22, marginTop: spacing.md, marginBottom: spacing.lg },
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
