import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

type Step = "welcome" | "consent" | "phase" | "paywall";
const ORDER: Step[] = ["welcome", "consent", "phase", "paywall"];

const PHASES = [
  { phase: 1, title: "Psychotherapy", duration: "Year 1", subtitle: "Build emotional safety & self-awareness through weekly reflection." },
  { phase: 2, title: "EMDR Processing", duration: "8 weeks", subtitle: "Reprocess memories alongside your therapist. Requires approval." },
  { phase: 3, title: "Ketamine + Somatic", duration: "Year 2", subtitle: "Deep-body integration and post-session care." },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [pronouns, setPronouns] = useState("");
  const [withTherapist, setWithTherapist] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const idx = ORDER.indexOf(step);

  const advanceFromWelcome = () => { Haptics.selectionAsync().catch(() => {}); setStep("consent"); };

  const submitConsent = async () => {
    if (!withTherapist) return;
    setSaving(true);
    try {
      await api.updateProfile({
        pronouns: pronouns || undefined,
        in_therapy: true,
        consent_accepted: true,
      });
      Haptics.selectionAsync().catch(() => {});
      setStep("phase");
    } finally { setSaving(false); }
  };

  const confirmPhase = async () => {
    if (selectedPhase == null) return;
    setSaving(true);
    try {
      await api.setStartingPhase(selectedPhase);
      Haptics.selectionAsync().catch(() => {});
      setStep("paywall");
    } finally { setSaving(false); }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ onboarding_complete: true });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)/home");
    } finally { setSaving(false); }
  };

  const goBack = () => {
    const i = ORDER.indexOf(step);
    if (i > 0) setStep(ORDER[i - 1]);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]} testID="onboarding-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.headerBar}>
          {step !== "welcome" ? (
            <Pressable onPress={goBack} testID="onb-back-button" style={styles.backBtn}>
              <Feather name="chevron-left" size={22} color={colors.onSurface} />
            </Pressable>
          ) : <View style={{ width: 36 }} />}
          <View style={styles.stepRow}>
            {ORDER.map((s, i) => (
              <View key={s} style={[styles.stepDot, i <= idx && styles.stepDotActive]} />
            ))}
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === "welcome" && (
            <View style={styles.pane}>
              <Text style={styles.eyebrow}>Hello, {user?.name?.split(" ")[0] ?? "friend"}</Text>
              <Text style={styles.hero}>Your sanctuary is ready.</Text>
              <Text style={styles.copy}>
                Project Life is a slow, structured companion to your healing work.
                We move at the pace of your nervous system.
              </Text>
              <View style={styles.principles}>
                <Text style={styles.principle}>— private and unhurried</Text>
                <Text style={styles.principle}>— structured across four seasons</Text>
                <Text style={styles.principle}>— always beside your therapy, never above it</Text>
              </View>
            </View>
          )}

          {step === "consent" && (
            <View style={styles.pane}>
              <Text style={styles.eyebrow}>Before we begin</Text>
              <Text style={styles.hero}>A quiet agreement.</Text>
              <Text style={styles.copy}>
                Project Life is a companion, not a replacement for therapy.
                Please confirm your understanding before we open the door.
              </Text>

              <Text style={styles.label}>Pronouns (optional)</Text>
              <TextInput
                testID="onb-pronouns-input"
                value={pronouns}
                onChangeText={setPronouns}
                placeholder="she/her, they/them…"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />

              <Pressable
                testID="onb-therapist-checkbox"
                onPress={() => setWithTherapist((v) => !v)}
                style={styles.checkRow}
              >
                <View style={[styles.check, withTherapist && styles.checkOn]}>
                  {withTherapist ? <Feather name="check" size={14} color={colors.onBrandPrimary} /> : null}
                </View>
                <Text style={styles.checkText}>I will work with a licensed therapist.</Text>
              </Pressable>
            </View>
          )}

          {step === "phase" && (
            <View style={styles.pane}>
              <Text style={styles.eyebrow}>Choose your season</Text>
              <Text style={styles.hero}>Where would you like to begin?</Text>
              <Text style={styles.copy}>You can grow at your own pace. Nothing here is a race.</Text>

              <View style={{ marginTop: spacing.xl }}>
                {PHASES.map((p) => {
                  const active = selectedPhase === p.phase;
                  return (
                    <Pressable
                      key={p.phase}
                      testID={`onb-phase-${p.phase}`}
                      onPress={() => setSelectedPhase(p.phase)}
                      style={[styles.phaseCard, active && styles.phaseCardActive]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.phaseHead}>
                          <Text style={styles.phaseTitle}>{p.title}</Text>
                          <Text style={styles.phaseDur}>{p.duration}</Text>
                        </View>
                        <Text style={styles.phaseSub}>{p.subtitle}</Text>
                      </View>
                      <View style={[styles.radio, active && styles.radioOn]}>
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === "paywall" && (
            <View style={styles.pane}>
              <Text style={styles.eyebrow}>Membership</Text>
              <Text style={styles.hero}>Support the sanctuary.</Text>
              <Text style={styles.copy}>
                A small monthly contribution keeps the sanctuary quiet, safe, and free of advertising.
              </Text>

              <View style={styles.priceBlock}>
                <Text style={styles.priceLead}>$20</Text>
                <Text style={styles.pricePeriod}>/ month</Text>
              </View>

              <View style={styles.perks}>
                <View style={styles.perkRow}>
                  <View style={styles.perkDot} />
                  <Text style={styles.perkText}>Full access to every season of the arc</Text>
                </View>
                <View style={styles.perkRow}>
                  <View style={styles.perkDot} />
                  <Text style={styles.perkText}>Encrypted journal, private forever</Text>
                </View>
                <View style={styles.perkRow}>
                  <View style={styles.perkDot} />
                  <Text style={styles.perkText}>Cancel anytime, keep your journal</Text>
                </View>
              </View>

              <Text style={styles.paywallHint}>Payments are not yet enabled. Continue to explore your sanctuary — you can subscribe when you&rsquo;re ready.</Text>
              <Text style={styles.paywallMark}>Backed by science · Therapist-designed</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === "welcome" && (
            <Pressable testID="onb-welcome-next" onPress={advanceFromWelcome} style={styles.primary}>
              <Text style={styles.primaryText}>Open the door</Text>
            </Pressable>
          )}
          {step === "consent" && (
            <Pressable
              testID="onb-consent-continue"
              onPress={submitConsent}
              disabled={!withTherapist || saving}
              style={[styles.primary, (!withTherapist || saving) && styles.primaryDisabled]}
            >
              {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>I understand & agree</Text>}
            </Pressable>
          )}
          {step === "phase" && (
            <Pressable
              testID="onb-confirm-phase"
              onPress={confirmPhase}
              disabled={selectedPhase == null || saving}
              style={[styles.primary, (selectedPhase == null || saving) && styles.primaryDisabled]}
            >
              {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Confirm your season</Text>}
            </Pressable>
          )}
          {step === "paywall" && (
            <Pressable
              testID="onb-finish-button"
              onPress={finish}
              disabled={saving}
              style={[styles.primary, saving && styles.primaryDisabled]}
            >
              {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Enter Project Life</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  stepRow: { flexDirection: "row", gap: spacing.sm },
  stepDot: { width: 22, height: 2, borderRadius: 1, backgroundColor: colors.divider },
  stepDotActive: { backgroundColor: colors.brandPrimary },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  pane: { flex: 1, paddingTop: spacing.xxl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  hero: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, color: colors.onSurface, fontWeight: "500", marginBottom: spacing.lg },
  copy: { fontFamily: fonts.body, fontSize: fontSize.lg, lineHeight: 26, color: colors.onSurfaceSecondary, marginBottom: spacing.xl },
  principles: { marginTop: spacing.md, gap: spacing.md },
  principle: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontStyle: "italic" },
  label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: spacing.sm, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 54 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  check: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  checkText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 22 },
  phaseCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  phaseCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary },
  phaseHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginBottom: spacing.xs },
  phaseTitle: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurface, fontWeight: "500" },
  phaseDur: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontStyle: "italic" },
  phaseSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 22 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.brandPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  priceBlock: { flexDirection: "row", alignItems: "baseline", marginTop: spacing.lg, marginBottom: spacing.xl },
  priceLead: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 60, color: colors.onSurface, fontWeight: "500" },
  pricePeriod: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, marginLeft: spacing.sm },
  perks: { gap: spacing.md, marginBottom: spacing.xl },
  perkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  perkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brandPrimary },
  perkText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, flex: 1 },
  paywallHint: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontStyle: "italic", lineHeight: 22, marginBottom: spacing.xl },
  paywallMark: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", letterSpacing: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  primary: { backgroundColor: colors.brandPrimary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 18, minHeight: 56 },
  primaryDisabled: { backgroundColor: colors.borderStrong },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.body, fontSize: fontSize.base, fontWeight: "500", letterSpacing: 0.5 },
});
