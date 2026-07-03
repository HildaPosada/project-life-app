import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

// This screen is opened via the deep link Supabase sends in the reset email.
// A valid session is already in place when the user arrives here.
export default function ResetPasswordScreen() {
  const { updatePassword, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = password.length >= 8 && password === confirm;

  const doUpdate = async () => {
    if (busy || !canSubmit) return;
    clearAuthError();
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch { /* error shown */ }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]} testID="reset-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Reset</Text>
          <Text style={styles.title}>Choose a new{"\n"}password.</Text>

          {done ? (
            <View style={styles.card}>
              <Feather name="check-circle" size={22} color={colors.brandPrimary} />
              <Text style={styles.cardTitle}>All set.</Text>
              <Text style={styles.cardCopy}>Your password has been updated. You&rsquo;re signed in.</Text>
              <Pressable
                testID="reset-continue-button"
                onPress={() => router.replace("/(tabs)/home")}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Continue</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <TextInput
                testID="reset-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="new password (8+ characters)"
                placeholderTextColor={colors.onSurfaceTertiary}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                testID="reset-confirm-input"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="confirm password"
                placeholderTextColor={colors.onSurfaceTertiary}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable
                testID="reset-submit-button"
                onPress={doUpdate}
                disabled={!canSubmit || busy}
                style={[styles.primary, (!canSubmit || busy) && styles.primaryDisabled]}
              >
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Update password</Text>}
              </Pressable>
              {authError ? (
                <View style={styles.notice} testID="reset-notice">
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
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  title: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.onSurface, fontWeight: "500", marginBottom: spacing.xxl },
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
