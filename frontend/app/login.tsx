import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await login();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1605187151664-9d89904d62d0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwzfHx3YXJtJTIwam91cm5hbGluZyUyMGFlc3RoZXRpYyUyMG5vdGVib29rJTIwY29mZmVlfGVufDB8fHx8MTc4MzA2NjMxN3ww&ixlib=rb-4.1.0&q=85" }}
        style={styles.hero}
      />
      <LinearGradient
        colors={["rgba(249,248,245,0)", "rgba(249,248,245,0.8)", colors.surface]}
        style={styles.scrim}
      />
      <SafeAreaView style={styles.content} edges={["bottom", "left", "right"]}>
        <View style={styles.mark}>
          <View style={styles.markCircle}>
            <Feather name="feather" size={22} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.markText}>Project Life</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>A quiet place to walk your healing arc.</Text>
          <Text style={styles.subtitle}>
            A trauma-informed companion to your therapy — private, unhurried, and yours.
          </Text>
        </View>

        <Pressable
          testID="login-google-button"
          onPress={onPress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Feather name="log-in" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.ctaText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.tiny}>By continuing, you accept our disclaimer and terms. This app supports — but does not replace — therapy.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: "60%" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, height: "70%" },
  content: { flex: 1, justifyContent: "flex-end", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  mark: { flexDirection: "row", alignItems: "center", gap: spacing.md, position: "absolute", top: spacing.xxxl + spacing.lg, left: spacing.xl },
  markCircle: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  markText: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface },
  copy: { marginBottom: spacing.xxl },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: colors.onSurface, marginBottom: spacing.md },
  subtitle: { fontFamily: fonts.body, fontSize: fontSize.lg, lineHeight: 24, color: colors.onSurfaceSecondary },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radius.pill, minHeight: 52 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: colors.onBrandPrimary, fontFamily: fonts.body, fontSize: fontSize.lg, fontWeight: "500" },
  tiny: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.lg, lineHeight: 18 },
});
