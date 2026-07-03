import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function ForgotPasswordScreen() {
  const { forgotPassword, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const doSend = async () => {
    if (busy || !email.trim()) return;
    clearAuthError();
    setBusy(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch { /* error shown */ }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]} testID="forgot-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.appbar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="forgot-back-button">
            <Feather name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>A gentle reset</Text>
          <Text style={styles.title}>Forgot your{"\n"}password?</Text>
          <Text style={styles.copy}>Enter your email and we&rsquo;ll send a quiet link to set a new one.</Text>

          {sent ? (
            <View style={styles.card}>
              <Feather name="mail" size={20} color={colors.brandPrimary} />
              <Text style={styles.cardTitle}>Check your inbox.</Text>
              <Text style={styles.cardCopy}>
                If an account exists for {email}, a reset link is on its way. It expires in an hour.
              </Text>
              <Pressable testID="forgot-back-to-login" onPress={() => router.replace("/login")} style={styles.primary}>
                <Text style={styles.primaryText}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <TextInput
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="email"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
              />
              <Pressable
                testID="forgot-send-button"
                onPress={doSend}
                disabled={!email.trim() || busy}
                style={[styles.primary, (!email.trim() || busy) && styles.primaryDisabled]}
              >
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Send reset link</Text>}
              </Pressable>
              {authError ? (
                <View style={styles.notice} testID="forgot-notice">
                  <Feather name="alert-circle" size={14} color={colors.error} />
                  <Text style={styles.noticeText}>{authError}</Text>
                </View>
              ) : null}
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
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 16, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 54, marginBottom: spacing.md },
  primary: { marginTop: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 18, minHeight: 56 },
  primaryDisabled: { backgroundColor: colors.borderStrong },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.body, fontSize: fontSize.base, fontWeight: "500", letterSpacing: 0.3 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.error, lineHeight: 20 },
  card: { alignItems: "center", padding: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, gap: spacing.md },
  cardTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onSurface, fontWeight: "500" },
  cardCopy: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 22 },
});
