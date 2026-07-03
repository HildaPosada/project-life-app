import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

const STEPS: { n: string; title: string; sub?: string }[] = [
  { n: "1", title: "Find a Directory", sub: "Start your search on sites like PsychologyToday.com" },
  { n: "2", title: "Filter by specialty", sub: "Look for Psychotherapy, EMDR, or Somatic Therapy." },
  { n: "3", title: "Search for PsyD or PhD." },
  { n: "4", title: "Schedule a free consultation." },
  { n: "5", title: "Talk about fit" },
];

const GREEN_FLAGS = ["Trauma-informed language", "Clear scope of practice", "Consistent scheduling", "Warm curiosity, not judgement"];
const RED_FLAGS = ["Promises to 'fix' you", "Pushy about a single modality", "Poor boundaries around time", "No supervision or peer network"];

export default function FindTherapistScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="find-therapist-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="ft-back-button">
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>How to Find a Therapist</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.copy}>
          This app requires that you work with a licensed therapist. Here&rsquo;s how to get started:
        </Text>

        <View style={styles.steps}>
          {STEPS.map((s) => (
            <View key={s.n} style={styles.stepRow}>
              <View style={styles.stepBadge}><Text style={styles.stepNum}>{s.n}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                {s.sub ? <Text style={styles.stepSub}>{s.sub}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.quoteBox}>
          <Text style={styles.quoteLabel}>Suggested opening line</Text>
          <Text style={styles.quote}>
            &ldquo;Hi, I&rsquo;m looking for a licensed therapist to support me through a trauma-informed healing journey.&rdquo;
          </Text>
        </View>

        <View style={styles.flagsSection}>
          <View style={styles.flagsHalf}>
            <View style={[styles.flagHead, { backgroundColor: "#DCFCE7" }]}>
              <Feather name="check-circle" size={14} color="#166534" />
              <Text style={[styles.flagHeadText, { color: "#166534" }]}>Green flags</Text>
            </View>
            {GREEN_FLAGS.map((f) => (
              <View key={f} style={styles.flagRow}>
                <View style={[styles.flagDot, { backgroundColor: "#166534" }]} />
                <Text style={styles.flagText}>{f}</Text>
              </View>
            ))}
          </View>
          <View style={styles.flagsHalf}>
            <View style={[styles.flagHead, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="alert-triangle" size={14} color="#991B1B" />
              <Text style={[styles.flagHeadText, { color: "#991B1B" }]}>Red flags</Text>
            </View>
            {RED_FLAGS.map((f) => (
              <View key={f} style={styles.flagRow}>
                <View style={[styles.flagDot, { backgroundColor: "#991B1B" }]} />
                <Text style={styles.flagText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  appTitle: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurface, fontWeight: "600" },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, paddingTop: spacing.lg },
  copy: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 22, fontWeight: "500", marginBottom: spacing.xl },
  steps: { gap: spacing.md },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  stepNum: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurface, fontWeight: "700" },
  stepTitle: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "600" },
  stepSub: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2, lineHeight: 20 },
  quoteBox: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border },
  quoteLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  quote: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 22, fontStyle: "italic" },
  flagsSection: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  flagsHalf: { flex: 1 },
  flagHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, alignSelf: "flex-start", marginBottom: spacing.md },
  flagHeadText: { fontFamily: fonts.body, fontSize: fontSize.sm, fontWeight: "600" },
  flagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  flagDot: { width: 6, height: 6, borderRadius: 3 },
  flagText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurface, lineHeight: 18 },
});
