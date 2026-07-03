import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

export default function OnboardingScreen() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pronouns, setPronouns] = useState("");
  const [location, setLocation] = useState("");
  const [inTherapy, setInTherapy] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    setStep((s) => s + 1);
  };

  const finish = async () => {
    if (!consent) return;
    setSaving(true);
    try {
      await api.updateProfile({
        pronouns,
        location,
        in_therapy: inTherapy,
        consent_accepted: consent,
        onboarding_complete: true,
      });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/(tabs)/home");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="onboarding-screen" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.step}>Step {step + 1} of 4</Text>
          <View style={styles.progressWrap}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View>
              <Text style={styles.title}>Welcome, {user?.name?.split(" ")[0] ?? "friend"}.</Text>
              <Text style={styles.p}>
                Project Life is a slow, structured companion to your healing work. We move at the pace of your nervous system, not the internet.
              </Text>
              <Text style={styles.p}>
                Nothing here replaces therapy. If you are in crisis, please reach out to trusted support or a crisis line.
              </Text>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.title}>A little about you</Text>
              <Text style={styles.label}>Pronouns (optional)</Text>
              <TextInput
                testID="onb-pronouns-input"
                value={pronouns}
                onChangeText={setPronouns}
                placeholder="she/her, they/them…"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
              <Text style={styles.label}>Location (optional)</Text>
              <TextInput
                testID="onb-location-input"
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>Are you working with a therapist?</Text>
              <Text style={styles.p}>This app is designed to complement therapy. Your answer helps us tailor prompts.</Text>
              <Pressable
                testID="onb-therapy-yes"
                onPress={() => setInTherapy(true)}
                style={[styles.choice, inTherapy === true && styles.choiceActive]}
              >
                <Feather name="check" size={18} color={inTherapy === true ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.choiceText, inTherapy === true && styles.choiceTextActive]}>Yes, currently</Text>
              </Pressable>
              <Pressable
                testID="onb-therapy-no"
                onPress={() => setInTherapy(false)}
                style={[styles.choice, inTherapy === false && styles.choiceActive]}
              >
                <Feather name="x" size={18} color={inTherapy === false ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.choiceText, inTherapy === false && styles.choiceTextActive]}>Not right now</Text>
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Consent & safety</Text>
              <Text style={styles.p}>Please read and accept before we begin:</Text>
              <View style={styles.consentBox}>
                <Text style={styles.consentText}>
                  • This app is a self-directed emotional healing companion, not a medical service.{"\n"}
                  • Content, prompts, and check-ins are educational, not clinical advice.{"\n"}
                  • Your entries are private to your account.{"\n"}
                  • Phase 2 (EMDR) requires written approval from a qualified therapist.{"\n"}
                  • If you are in crisis, use the Safety Net or contact emergency services.
                </Text>
              </View>
              <Pressable
                testID="onb-consent-toggle"
                onPress={() => setConsent((c) => !c)}
                style={[styles.consentToggle, consent && styles.consentToggleActive]}
              >
                <Feather name={consent ? "check-square" : "square"} size={22} color={consent ? colors.brandPrimary : colors.onSurfaceSecondary} />
                <Text style={styles.consentToggleText}>I have read and accept these terms.</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 3 ? (
            <Pressable testID="onb-next-button" onPress={next} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Feather name="arrow-right" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          ) : (
            <Pressable
              testID="onb-finish-button"
              onPress={finish}
              disabled={!consent || saving}
              style={[styles.primaryBtn, (!consent || saving) && styles.primaryBtnDisabled]}
            >
              {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                <>
                  <Text style={styles.primaryBtnText}>Begin</Text>
                  <Feather name="arrow-right" size={18} color={colors.onBrandPrimary} />
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  step: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.sm },
  progressWrap: { flexDirection: "row", gap: spacing.sm },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceTertiary },
  progressDotActive: { backgroundColor: colors.brandPrimary },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.onSurface, marginBottom: spacing.lg, lineHeight: 34 },
  p: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, marginBottom: spacing.lg, lineHeight: 24 },
  label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurface, backgroundColor: colors.surfaceSecondary },
  choice: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  choiceActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  choiceText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurface },
  choiceTextActive: { color: colors.onBrandPrimary },
  consentBox: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  consentText: { fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: 22, color: colors.onSurfaceSecondary },
  consentToggle: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md },
  consentToggleActive: { backgroundColor: colors.surfaceSecondary },
  consentToggleText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, flex: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  primaryBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill, minHeight: 52 },
  primaryBtnDisabled: { backgroundColor: colors.surfaceTertiary },
  primaryBtnText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onBrandPrimary, fontWeight: "500" },
});
