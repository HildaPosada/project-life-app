import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function SignUpScreen() {
  const { signUpWithEmail, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim().length >= 2 && email.trim().length > 3 && password.length >= 8;

  const doSignUp = async () => {
    if (busy || !canSubmit) return;
    clearAuthError();
    setBusy(true);
    try {
      const { needsVerification } = await signUpWithEmail(email.trim().toLowerCase(), password, name.trim());
      if (needsVerification) setSent(true);
    } catch { /* error shown */ }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]} testID="signup-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.appbar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="signup-back-button">
            <Feather name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Begin</Text>
          <Text style={styles.title}>Create your{"\n"}sanctuary.</Text>
          <Text style={styles.copy}>A few gentle details to open the door.</Text>

          {sent ? (
            <View style={styles.verifyCard} testID="signup-verify-card">
              <Feather name="mail" size={24} color={colors.brandPrimary} />
              <Text style={styles.verifyTitle}>Check your inbox.</Text>
              <Text style={styles.verifyCopy}>
                We&rsquo;ve sent a verification link to {email}. Confirm your email, then return here to sign in.
              </Text>
              <Pressable
                testID="signup-back-to-login"
                onPress={() => router.replace("/login")}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                testID="signup-name-input"
                value={name}
                onChangeText={setName}
                placeholder="your name"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="words"
                style={styles.input}
              />
              <TextInput
                testID="signup-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="email"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
              />
              <TextInput
                testID="signup-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="password (at least 8 characters)"
                placeholderTextColor={colors.onSurfaceTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                style={styles.input}
              />

              <Pressable
                testID="signup-submit-button"
                onPress={doSignUp}
                disabled={!canSubmit || busy}
                style={[styles.primary, (!canSubmit || busy) && styles.primaryDisabled]}
              >
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Create account</Text>}
              </Pressable>

              {authError ? (
                <View style={styles.notice} testID="signup-notice">
                  <Feather name="alert-circle" size={14} color={colors.error} />
                  <Text style={styles.noticeText}>{authError}</Text>
                </View>
              ) : null}

              <Text style={styles.foot}>
                By creating an account, you accept our Terms and understand that Project Life is a companion, not a replacement for therapy.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md, marginTop: spacing.xl },
  title: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.onSurface, fontWeight: "500", marginBottom: spacing.md },
  copy: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontStyle: "italic", lineHeight: 26, marginBottom: spacing.xxl },
  form: {},
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 54, marginBottom: spacing.md },
  primary: { marginTop: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 18, minHeight: 56 },
  primaryDisabled: { backgroundColor: colors.borderStrong },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.body, fontSize: fontSize.base, fontWeight: "500", letterSpacing: 0.3 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.error, lineHeight: 20 },
  foot: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 20, marginTop: spacing.xl },
  verifyCard: { alignItems: "center", padding: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, gap: spacing.md, marginTop: spacing.md },
  verifyTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onSurface, fontWeight: "500" },
  verifyCopy: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 22 },
});
