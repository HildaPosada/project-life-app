import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Animated, Easing, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { SanctuaryScene, Stone } from "@/src/components/SanctuaryScene";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Rest well";
}

type Context = {
  days_since_last_activity: number | null;
  active_days_count: number;
  is_first_visit: boolean;
  is_returning: boolean;
  milestone_today: boolean;
  milestone_title: string | null;
};

// A gentle, contextual affirmation. Never generic when we have signal.
function contextualAffirmation(ctx: Context | null, firstName: string): string {
  if (!ctx) return "welcome.";
  if (ctx.is_first_visit) return "welcome. begin, gently.";
  if (ctx.milestone_today && ctx.milestone_title) return `growth often happens quietly.`;
  if (ctx.is_returning) return `welcome back, ${firstName.toLowerCase()}.`;
  const d = ctx.days_since_last_activity ?? 0;
  if (d === 0) return "thank you for showing up again.";
  if (d === 1) return "you returned. that matters.";
  if (d <= 3) return "you are here. that is enough.";
  if (d <= 7) return "a week has passed. we are still here.";
  return "return, gently, to what is here.";
}

function useEntranceFade(steps: number, delayStep = 100) {
  const values = useRef(Array.from({ length: steps }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      delayStep,
      values.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [values, delayStep]);
  return values;
}

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const sanctuaryWidth = Math.min(screenWidth - spacing.xl * 2, 380);

  const [dash, setDash] = useState<any | null>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [stones, setStones] = useState<Stone[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const fades = useEntranceFade(5);

  const load = useCallback(async () => {
    try {
      const [d, p, m] = await Promise.all([
        api.dashboard(),
        api.listPhases(),
        api.memoryPath(),
      ]);
      setDash(d);
      setPhases(p);
      setStones(m?.stones ?? []);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = user?.name?.split(" ")[0] ?? "friend";
  const currentPhase = phases.find((p) => p.is_current);
  const activityCount = dash?.sessions_completed ?? 0;
  const context: Context | null = dash?.context ?? null;
  const affirmation = useMemo(() => contextualAffirmation(context, firstName), [context, firstName]);
  const seasonName = currentPhase?.title ?? "Groundwork";

  const openStone = (s: Stone) => {
    router.push(`/memory/${s.stone_id}`);
  };

  const [f1, f2, f3, f4, f5] = fades;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="today-screen">
      {/* Very quiet appbar — just a menu and an avatar, no title text */}
      <View style={styles.appbar}>
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push("/menu"); }}
          style={styles.iconBtn}
          testID="today-menu-button"
        >
          <Feather name="menu" size={20} color={colors.onSurface} />
        </Pressable>
        <View />
        <Pressable
          onPress={() => router.push("/menu")}
          style={styles.avatar}
          testID="today-avatar-button"
        >
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Editorial masthead */}
        <Animated.View style={{ opacity: f1, transform: [{ translateY: f1.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          <View style={styles.masthead}>
            <Text style={styles.eyebrow}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </Text>
            <Text style={styles.greet}>{timeGreeting()},{"\n"}{firstName}.</Text>
            <Text style={styles.affirm}>{affirmation}</Text>
          </View>
        </Animated.View>

        {/* 2. Painterly Sanctuary with tappable Memory Stones */}
        <Animated.View
          style={{
            opacity: f2,
            transform: [{ translateY: f2.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            alignItems: "center",
          }}
        >
          <SanctuaryScene
            activity={activityCount}
            stones={stones}
            onStonePress={openStone}
            width={sanctuaryWidth}
            height={260}
          />
          <Text style={styles.sanctuaryCaption}>{seasonName}</Text>
        </Animated.View>

        {/* 3. Three primary actions */}
        <Animated.View style={{ opacity: f3, transform: [{ translateY: f3.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Pressable
            testID="today-continue-button"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push(currentPhase ? `/phase/${currentPhase.phase}` : "/(tabs)/journey");
            }}
            style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrow}>Continue your journey</Text>
              <Text style={styles.actionTitle}>{seasonName}</Text>
              <Text style={styles.actionSub}>Take one gentle step today.</Text>
            </View>
            <Feather name="arrow-right" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </Animated.View>

        <Animated.View style={{ opacity: f4, transform: [{ translateY: f4.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Pressable
            testID="today-journal-button"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push("/journal-entry");
            }}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrowLight}>Journal</Text>
              <Text style={styles.actionTitleLight}>Write, softly.</Text>
            </View>
            <Feather name="edit-3" size={18} color={colors.onSurface} />
          </Pressable>
        </Animated.View>

        <Animated.View style={{ opacity: f5, transform: [{ translateY: f5.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Pressable
            testID="today-reflection-button"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push("/checkin");
            }}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionEyebrowLight}>Today&rsquo;s reflection</Text>
              <Text style={styles.actionTitleLight}>A quiet weekly check-in.</Text>
            </View>
            <Feather name="feather" size={18} color={colors.onSurface} />
          </Pressable>
        </Animated.View>

        {/* Whispered footer — safety + therapist */}
        <Animated.View style={{ opacity: f5 }}>
          <View style={styles.quietRow}>
            <Pressable
              onPress={() => router.push("/safety")}
              testID="today-safety-button"
              style={styles.quietBtn}
            >
              <Text style={styles.quietText}>Safety net</Text>
            </Pressable>
            <Text style={styles.quietSep}>·</Text>
            <Pressable
              onPress={() => router.push("/find-therapist")}
              testID="today-therapist-button"
              style={styles.quietBtn}
            >
              <Text style={styles.quietText}>Find a therapist</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  iconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl },

  // Masthead
  masthead: { marginBottom: spacing.xxl },
  eyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase" },
  greet: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.onSurface, fontWeight: "500", marginTop: spacing.md },
  affirm: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.brandPrimary, fontStyle: "italic", marginTop: spacing.md, lineHeight: 30 },

  // Sanctuary
  sanctuaryCaption: { fontFamily: fonts.serif, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center", marginBottom: spacing.xxl, marginTop: spacing.md, letterSpacing: 1.5, fontStyle: "italic", textTransform: "lowercase" },

  // Actions
  pressed: { opacity: 0.88 },
  actionPrimary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, padding: spacing.xl, borderRadius: radius.md, minHeight: 108, marginBottom: spacing.md },
  actionEyebrow: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.brandTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.sm },
  actionTitle: { fontFamily: fonts.serif, fontSize: fontSize.xxl, color: colors.onBrandPrimary, fontWeight: "500" },
  actionSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.brandTertiary, marginTop: 6, lineHeight: 20 },
  actionSecondary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radius.md, minHeight: 80, marginBottom: spacing.md },
  actionEyebrowLight: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.xs },
  actionTitleLight: { fontFamily: fonts.serif, fontSize: fontSize.xl, color: colors.onSurface, fontWeight: "500" },

  // Quiet footer
  quietRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginTop: spacing.xxl },
  quietBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  quietText: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, letterSpacing: 0.5 },
  quietSep: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
});
