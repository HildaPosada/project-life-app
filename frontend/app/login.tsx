import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, signInWithApple, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "apple">(null);

  const doEmail = async () => {
    if (busy) return;
    clearAuthError();
    if (!email.trim() || !password) return;
    setBusy("email");
    try { await signInWithEmail(email.trim().toLowerCase(), password); }
    catch { /* error shown via authError */ }
    finally { setBusy(null); }
  };

  const doGoogle = async () => {
    if (busy) return;
    clearAuthError();
    setBusy("google");
    try { await signInWithGoogle(); } finally { setBusy(null); }
  };

  const doApple = async () => {
    if (busy) return;
    clearAuthError();
    setBusy("apple");
    try { await signInWithApple(); } finally { setBusy(null); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.markRow}>
            <View style={styles.mark} />
            <Text style={styles.markText}>Project Life</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>A sanctuary for healing</Text>
            <Text style={styles.title}>Welcome{"\n"}back.</Text>
            <Text style={styles.copy}>Sign in to your quiet corner of the world.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              testID="login-email-input"
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
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="password"
              placeholderTextColor={colors.onSurfaceTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              style={styles.input}
            />

            <Pressable
              testID="login-forgot-button"
              onPress={() => router.push("/forgot-password")}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </Pressable>

            <Pressable
              testID="login-submit-button"
              onPress={doEmail}
              style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, (!email || !password) && styles.primaryDisabled]}
              disabled={busy !== null || !email || !password}
            >
              {busy === "email" ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Continue</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or</Text>
              <View style={styles.divLine} />
            </View>

            <Pressable
              testID="login-google-button"
              onPress={doGoogle}
              style={({ pressed }) => [styles.social, pressed && styles.socialPressed]}
              disabled={busy !== null}
            >
              {busy === "google" ? <ActivityIndicator color={colors.onSurface} /> : (
                <>
                  <FontAwesome name="google" size={16} color={colors.onSurface} />
                  <Text style={styles.socialText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <Pressable
              testID="login-apple-button"
              onPress={doApple}
              style={({ pressed }) => [styles.social, pressed && styles.socialPressed]}
              disabled={busy !== null}
            >
              {busy === "apple" ? <ActivityIndicator color={colors.onSurface} /> : (
                <>
                  <FontAwesome name="apple" size={18} color={colors.onSurface} />
                  <Text style={styles.socialText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>

            {authError ? (
              <View style={styles.notice} testID="login-notice">
                <Feather name="alert-circle" size={14} color={colors.error} />
                <Text style={styles.noticeText}>{authError}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.tiny}>New here? </Text>
            <Pressable onPress={() => router.push("/sign-up")} testID="login-signup-link">
              <Text style={styles.signupLink}>Create an account.</Text>
            </Pressable>
          </View>

          <Text style={styles.tiny}>Project Life is a companion, not a replacement for therapy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  markRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xxl },
  mark: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandPrimary },
  markText: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "500", letterSpacing: 0.3 },
  hero: { marginBottom: spacing.xxl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  title: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 50, color: colors.onSurface, fontWeight: "500", marginBottom: spacing.md },
  copy: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, fontStyle: "italic", lineHeight: 26 },
  form: { marginBottom: spacing.xl },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 54, marginBottom: spacing.md },
  forgotBtn: { alignSelf: "flex-end", paddingVertical: spacing.sm },
  forgotText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, textDecorationLine: "underline" },
  primary: { marginTop: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 18, minHeight: 56 },
  primaryPressed: { opacity: 0.9 },
  primaryDisabled: { backgroundColor: colors.borderStrong },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.body, fontSize: fontSize.base, fontWeight: "500", letterSpacing: 0.3 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.lg },
  divLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  divText: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, fontStyle: "italic" },
  social: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 16, minHeight: 54, marginBottom: spacing.md },
  socialPressed: { backgroundColor: colors.surfaceSecondary },
  socialText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.error, lineHeight: 20 },
  signupRow: { flexDirection: "row", justifyContent: "center", marginBottom: spacing.md },
  tiny: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 20 },
  signupLink: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.brandPrimary, fontWeight: "500" },
});
