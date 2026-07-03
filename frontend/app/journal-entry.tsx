import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

// A hardcover-notebook writing surface. Nearly blank canvas. One serif for
// the title, one sans for the body. Autosave every ~1.5s of quiet typing.

const MOOD_WORDS = ["Heavy", "Tender", "Anxious", "Grounded", "Open", "Grateful", "Hopeful", "Numb", "Steady", "Tired"];

type SaveState = "idle" | "saving" | "saved";

export default function JournalEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ?? undefined;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moodWord, setMoodWord] = useState<string | null>(null);
  const [moodScore, setMoodScore] = useState<number>(3);
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState(!!editingId);
  const [entryId, setEntryId] = useState<string | undefined>(editingId);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFade = useRef(new Animated.Value(0)).current;
  const canvasFade = useRef(new Animated.Value(0)).current;

  // On mount — fetch prompt + existing entry if editing.
  useEffect(() => {
    (async () => {
      try {
        const [p, entriesIfNeeded] = await Promise.all([
          api.journalPrompt().catch(() => null),
          editingId ? api.listJournal() : Promise.resolve(null),
        ]);
        if (p?.prompt) setPrompt(p.prompt);
        if (editingId && entriesIfNeeded) {
          const found = entriesIfNeeded.find((e: any) => e.entry_id === editingId);
          if (found) {
            setTitle(found.title ?? "");
            setBody(found.body ?? "");
            setMoodWord(found.mood_word ?? null);
            setMoodScore(found.mood_score ?? 3);
          }
        }
      } finally {
        setLoading(false);
        Animated.timing(canvasFade, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    })();
  }, [editingId, canvasFade]);

  // Autosave — debounced. Creates on first save, then updates.
  const saveNow = useCallback(async (fields: { title?: string; body?: string; mood_word?: string | null; mood_score?: number }) => {
    if (!body.trim() && !title.trim() && !fields.body?.trim() && !fields.title?.trim()) return;
    const payload = {
      title: fields.title ?? title ?? undefined,
      body: fields.body ?? body,
      mood_word: (fields.mood_word ?? moodWord) ?? undefined,
      mood_score: fields.mood_score ?? moodScore,
    };
    setSaveState("saving");
    try {
      if (entryId) {
        await api.updateJournal(entryId, payload);
      } else {
        const created = await api.createJournal(payload);
        setEntryId(created.entry_id);
      }
      setSaveState("saved");
      Animated.sequence([
        Animated.timing(savedFade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(savedFade, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start(() => setSaveState("idle"));
    } catch {
      setSaveState("idle");
    }
  }, [title, body, moodWord, moodScore, entryId, savedFade]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow({}), 1500);
  }, [saveNow]);

  const handleTitle = (t: string) => { setTitle(t); scheduleSave(); };
  const handleBody = (t: string) => { setBody(t); scheduleSave(); };
  const handleMood = (w: string) => {
    const next = moodWord === w ? null : w;
    setMoodWord(next);
    Haptics.selectionAsync().catch(() => {});
    saveNow({ mood_word: next });
  };
  const handleScore = (n: number) => {
    setMoodScore(n);
    Haptics.selectionAsync().catch(() => {});
    saveNow({ mood_score: n });
  };

  const onClose = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if ((title.trim() || body.trim()) && saveState !== "saved") {
      await saveNow({});
    }
    if (title.trim() || body.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    router.back();
  };

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} testID="journal-entry-loading">
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="journal-entry-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.appbar}>
          <Pressable onPress={onClose} style={styles.iconBtn} testID="journal-close-button">
            <Feather name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>

          <Animated.View style={[styles.savedBadge, { opacity: savedFade }]} pointerEvents="none">
            <Feather name="check" size={12} color={colors.brandPrimary} />
            <Text style={styles.savedText}>saved</Text>
          </Animated.View>

          <Pressable onPress={onClose} style={styles.iconBtn} testID="journal-done-button">
            <Feather name="check" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <Animated.View style={{ flex: 1, opacity: canvasFade }}>
          <ScrollView contentContainerStyle={styles.canvas} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.date}>{dateStr}</Text>

            <TextInput
              testID="journal-title-input"
              value={title}
              onChangeText={handleTitle}
              placeholder="Title (optional)"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.titleInput}
              multiline
              scrollEnabled={false}
            />

            {prompt && !body.trim() ? (
              <Text style={styles.prompt}>{prompt}</Text>
            ) : null}

            <TextInput
              testID="journal-body-input"
              value={body}
              onChangeText={handleBody}
              placeholder="Begin, anywhere."
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.bodyInput}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              autoFocus={!editingId}
            />

            {/* Mood — appears only after user has written something */}
            {(body.trim() || moodWord) ? (
              <View style={styles.moodBlock}>
                <Text style={styles.moodLabel}>A word for how it felt</Text>
                <View style={styles.moodChips}>
                  {MOOD_WORDS.map((w) => (
                    <Pressable
                      key={w}
                      testID={`journal-mood-word-${w}`}
                      onPress={() => handleMood(w)}
                      style={[styles.moodChip, moodWord === w && styles.moodChipOn]}
                    >
                      <Text style={[styles.moodChipText, moodWord === w && styles.moodChipTextOn]}>
                        {w.toLowerCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.moodLabel, { marginTop: spacing.xl }]}>overall</Text>
                <View style={styles.scoreRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      testID={`journal-mood-${n}`}
                      onPress={() => handleScore(n)}
                      style={[styles.scoreDot, moodScore === n && styles.scoreDotOn]}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  savedText: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.brandPrimary, letterSpacing: 1 },

  canvas: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  date: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  titleInput: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 40, color: colors.onSurface, fontWeight: "500", paddingVertical: spacing.sm, marginBottom: spacing.md },
  prompt: { fontFamily: fonts.serif, fontSize: fontSize.lg, color: colors.onSurfaceTertiary, fontStyle: "italic", lineHeight: 28, marginBottom: spacing.lg },
  bodyInput: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onSurface, lineHeight: 30, minHeight: 320, paddingVertical: spacing.md, letterSpacing: 0.2 },

  moodBlock: { marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.divider },
  moodLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.onSurfaceTertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: spacing.md },
  moodChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  moodChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  moodChipOn: { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary },
  moodChipText: { fontFamily: fonts.serif, fontSize: fontSize.base, color: colors.onSurface, fontStyle: "italic" },
  moodChipTextOn: { color: colors.brandPrimary },
  scoreRow: { flexDirection: "row", gap: spacing.md },
  scoreDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.borderStrong },
  scoreDotOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
});
