import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, FontAwesome } from "@expo/vector-icons";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function LoginScreen() {
  const { login, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email" | "apple">(null);
  const [notice, setNotice] = useState<string | null>(null);

  const doGoogle = async () => {
    if (busy) return;
    clearAuthError();
    setNotice(null);
    setBusy("google");
    try { await login(); } finally { setBusy(null); }
  };
  const doApple = () => setNotice("Apple sign-in becomes available on native build. Please continue with Google.");
  const doEmail = () => setNotice("Email sign-up is coming soon. For now, continue with Google below.");

  const shownNotice = authError ?? notice;

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
            <Text style={styles.title}>Welcome, gently.</Text>
            <Text style={styles.copy}>
              A trauma-informed companion designed to sit beside your therapy work — quiet, private, and unhurried.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@domain.com"
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <Pressable
              testID="login-continue-button"
              onPress={doEmail}
              style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              disabled={busy !== null}
            >
              <Text style={styles.primaryText}>Continue</Text>
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
              {busy === "google" ? (
                <ActivityIndicator color={colors.onSurface} />
              ) : (
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
              <FontAwesome name="apple" size={18} color={colors.onSurface} />
              <Text style={styles.socialText}>Continue with Apple</Text>
            </Pressable>

            {shownNotice ? (
              <View style={styles.notice} testID="login-notice">
                <Feather name="feather" size={14} color={colors.onSurfaceSecondary} />
                <Text style={styles.noticeText}>{shownNotice}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.tiny}>
            By continuing, you accept our Terms and Privacy Policy. Project Life is a companion, not a replacement for therapy.
          </Text>
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
  title: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.onSurface, fontWeight: "500", marginBottom: spacing.md },
  copy: { fontFamily: fonts.body, fontSize: fontSize.lg, lineHeight: 26, color: colors.onSurfaceSecondary },
  form: { marginBottom: spacing.xl },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 54 },
  primary: { marginTop: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 18, minHeight: 56 },
  primaryPressed: { opacity: 0.9 },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.body, fontSize: fontSize.base, fontWeight: "500", letterSpacing: 0.3 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.lg },
  divLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  divText: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, fontStyle: "italic" },
  social: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 16, minHeight: 54, marginBottom: spacing.md },
  socialPressed: { backgroundColor: colors.surfaceSecondary },
  socialText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500" },
  notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, lineHeight: 20 },
  tiny: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 20, marginTop: spacing.md },
});
