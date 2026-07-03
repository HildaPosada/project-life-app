import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { EntitlementProvider } from "@/src/context/EntitlementContext";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const inTabs = first === "(tabs)";
    const publicRoutes = ["login", "sign-up", "forgot-password", "reset-password", "auth-confirmed"];

    if (!session) {
      if (!publicRoutes.includes(first)) router.replace("/login");
    } else if (user && !user.onboarding_complete) {
      if (first !== "onboarding") router.replace("/onboarding");
    } else if (user && !inTabs) {
      const allowedAuthed = ["(tabs)", "safety", "checkin", "journal-entry", "phase", "timeline-new", "upload-new", "session-log-new", "find-therapist", "menu", "memory", "reset-password", "paywall"];
      if (!allowedAuthed.includes(first)) router.replace("/(tabs)/home");
    }
  }, [user, session, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.loader} testID="root-loader">
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <AuthProvider>
          <EntitlementProvider>
            <AuthGate />
          </EntitlementProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});
