import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

const PHASE_DESCRIPTION: Record<number, { blurb: string; activities: string[] }> = {
  0: {
    blurb: "The foundation. Consent, safety, and self-orientation before the deeper work begins.",
    activities: ["Complete onboarding", "Set your safety net", "Meet the practices library"],
  },
  1: {
    blurb: "A year of steady, weekly reflection alongside your therapist. Small, honest touchpoints build the ground for later phases.",
    activities: ["Weekly check-ins", "Upload therapy summaries", "Monthly guided review"],
  },
  2: {
    blurb: "EMDR memory reprocessing, only with therapist approval. Bilateral practices, memory logging, and body awareness.",
    activities: ["Upload EMDR approval", "Log target memories", "Practice bilateral resourcing"],
  },
  3: {
    blurb: "Somatic and ketamine integration. Body-based practices and post-session integration notes for lasting change.",
    activities: ["Log integration sessions", "Deepen somatic practice", "Map your healing arc"],
  },
};

export default function PhaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const phaseNum = parseInt(id ?? "0", 10);
  const router = useRouter();
  const { refresh } = useAuth();
  const [phase, setPhase] = useState<any | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [memTitle, setMemTitle] = useState("");
  const [memDesc, setMemDesc] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    try {
      const phases = await api.listPhases();
      setPhase(phases.find((p: any) => p.phase === phaseNum) ?? null);
      if (phaseNum === 2) setMemories(await api.listMemories());
      if (phaseNum === 3) setSessionLogs(await api.listSessionLogs());
    } catch { /* ignore */ }
  }, [phaseNum]);

  useEffect(() => { load(); }, [load]);

  const advance = async () => {
    setAdvancing(true);
    try {
      await api.advancePhase();
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      // Advance not allowed; UI shows requirements.
    } finally {
      setAdvancing(false);
    }
  };

  const addMemory = async () => {
    if (!memTitle.trim() || !memDesc.trim()) return;
    await api.createMemory({ title: memTitle, description: memDesc });
    setMemTitle(""); setMemDesc("");
    load();
  };

  if (!phase) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  const meta = PHASE_DESCRIPTION[phaseNum] ?? { blurb: "", activities: [] };
  const isCurrent = phase.is_current;
  const canAdvance = isCurrent && phase.progress_pct >= 100 && phaseNum < 3;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID={`phase-screen-${phaseNum}`}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="phase-close-button" style={styles.close}>
            <Feather name="arrow-left" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>Phase {phase.phase}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.hero}>{phase.title}</Text>
          <Text style={styles.duration}>{phase.duration}</Text>
          {!phase.is_unlocked && (
            <View style={styles.lockedBanner}>
              <Feather name="lock" size={14} color={colors.warning} />
              <Text style={styles.lockedText}>Locked. Complete Phase {phase.phase - 1} first.</Text>
            </View>
          )}

          <Text style={styles.blurb}>{meta.blurb}</Text>

          <View style={styles.progressCard}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${phase.progress_pct}%` }]} />
            </View>
            <Text style={styles.progressText}>{phase.progress_pct}% along</Text>
          </View>

          <Text style={styles.sectionTitle}>What this phase includes</Text>
          {meta.activities.map((a) => (
            <View key={a} style={styles.activityRow}>
              <Feather name="check-circle" size={16} color={colors.brandPrimary} />
              <Text style={styles.activityText}>{a}</Text>
            </View>
          ))}
          <Text style={styles.sectionTitle}>Requirements</Text>
          {phase.requirements.map((r: string) => (
            <View key={r} style={styles.activityRow}>
              <Feather name="circle" size={12} color={colors.onSurfaceSecondary} />
              <Text style={styles.activityText}>{r}</Text>
            </View>
          ))}

          {phaseNum === 2 && phase.is_unlocked && (
            <View style={styles.subBlock}>
              <Text style={styles.sectionTitle}>Memories bank</Text>
              <Text style={styles.subHint}>Encrypted, private, never shared. For discussion in EMDR sessions.</Text>
              <TextInput
                testID="memory-title-input"
                value={memTitle}
                onChangeText={setMemTitle}
                placeholder="Title / reference"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
              <TextInput
                testID="memory-desc-input"
                value={memDesc}
                onChangeText={setMemDesc}
                placeholder="Description, body sensations, target beliefs"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={[styles.input, styles.textArea]}
                multiline
              />
              <Pressable testID="memory-add-button" onPress={addMemory} style={styles.smallPrimary}>
                <Feather name="plus" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.smallPrimaryText}>Add memory</Text>
              </Pressable>
              {memories.map((m) => (
                <View key={m.memory_id} style={styles.memCard} testID={`memory-${m.memory_id}`}>
                  <Text style={styles.memTitle}>{m.title}</Text>
                  <Text style={styles.memDesc}>{m.description}</Text>
                </View>
              ))}
            </View>
          )}

          {phaseNum === 3 && phase.is_unlocked && (
            <View style={styles.subBlock}>
              <Text style={styles.sectionTitle}>Session logs</Text>
              <Pressable
                testID="session-log-add-button"
                onPress={() => router.push("/session-log-new")}
                style={styles.smallPrimary}
              >
                <Feather name="plus" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.smallPrimaryText}>Add session log</Text>
              </Pressable>
              {sessionLogs.map((s) => (
                <View key={s.log_id} style={styles.memCard}>
                  <Text style={styles.memTitle}>{s.session_type} · {new Date(s.date).toLocaleDateString()}</Text>
                  {s.insights ? <Text style={styles.memDesc}>{s.insights}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {isCurrent && canAdvance && (
            <Pressable
              testID="phase-advance-button"
              onPress={advance}
              disabled={advancing}
              style={styles.advanceBtn}
            >
              {advancing ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                <>
                  <Feather name="arrow-right" size={18} color={colors.onBrandPrimary} />
                  <Text style={styles.advanceText}>Move to Phase {phase.phase + 1}</Text>
                </>
              )}
            </Pressable>
          )}
        </ScrollView>
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
  hero: { fontFamily: fonts.display, fontSize: 30, color: colors.onSurface, marginTop: spacing.md },
  duration: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 4 },
  lockedBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  lockedText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.warning },
  blurb: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, marginTop: spacing.lg, lineHeight: 26 },
  progressCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brandPrimary },
  progressText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  activityText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  subBlock: { marginTop: spacing.lg },
  subHint: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  smallPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, padding: 12, borderRadius: radius.pill, marginTop: spacing.sm, marginBottom: spacing.lg },
  smallPrimaryText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },
  memCard: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  memTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface, marginBottom: spacing.xs },
  memDesc: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 22 },
  advanceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill, marginTop: spacing.xl, minHeight: 52 },
  advanceText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onBrandPrimary, fontWeight: "500" },
});
