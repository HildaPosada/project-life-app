import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { api } from "@/src/lib/api";

export default function SafetyScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | boolean>(null);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([api.listContacts(), api.crisisResources()]);
      setContacts(c);
      setResources(r.resources);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const answer = async (feel_safe: boolean) => {
    setSaving(true);
    try {
      await api.createSafetyCheckin({ feel_safe, note: note || undefined });
      setSaved(feel_safe);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    if (!name.trim() || !phone.trim()) return;
    await api.createContact({ name, phone, relationship: relationship || undefined });
    setName(""); setPhone(""); setRelationship("");
    load();
    Haptics.selectionAsync().catch(() => {});
  };

  const removeContact = async (id: string) => {
    await api.deleteContact(id);
    load();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="safety-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="safety-close-button" style={styles.close}>
            <Feather name="x" size={20} color={colors.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.title}>Safety Net</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.checkCard}>
            <Text style={styles.checkTitle}>Do you feel safe today?</Text>
            <Text style={styles.checkSub}>A quiet moment to notice. Answer honestly — this is only for you.</Text>
            {saved === null ? (
              <>
                <TextInput
                  testID="safety-note-input"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Optional: a note to yourself"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  style={styles.input}
                  multiline
                />
                <View style={styles.answerRow}>
                  <Pressable
                    testID="safety-yes-button"
                    onPress={() => answer(true)}
                    style={[styles.answerBtn, styles.answerYes]}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                      <>
                        <Feather name="check" size={16} color={colors.onBrandPrimary} />
                        <Text style={styles.answerText}>Yes, resourced</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    testID="safety-no-button"
                    onPress={() => answer(false)}
                    style={[styles.answerBtn, styles.answerNo]}
                    disabled={saving}
                  >
                    <Feather name="heart" size={16} color={colors.onBrandSecondary} />
                    <Text style={styles.answerText}>Needs care</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.answered}>
                <Feather name="check-circle" size={20} color={colors.brandPrimary} />
                <Text style={styles.answeredText}>Thank you. Answer stored gently.</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Emergency contacts</Text>
          {contacts.map((c) => (
            <View key={c.contact_id} style={styles.contactCard} testID={`contact-${c.contact_id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactMeta}>{c.phone}{c.relationship ? ` · ${c.relationship}` : ""}</Text>
              </View>
              <Pressable
                testID={`contact-call-${c.contact_id}`}
                onPress={() => Linking.openURL(`tel:${c.phone}`)}
                style={styles.callBtn}
              >
                <Feather name="phone" size={16} color={colors.onBrandPrimary} />
              </Pressable>
              <Pressable
                testID={`contact-delete-${c.contact_id}`}
                onPress={() => removeContact(c.contact_id)}
                style={styles.delBtn}
              >
                <Feather name="trash-2" size={14} color={colors.error} />
              </Pressable>
            </View>
          ))}

          <View style={styles.addBox}>
            <TextInput
              testID="contact-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Contact name"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <TextInput
              testID="contact-phone-input"
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor={colors.onSurfaceTertiary}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              testID="contact-relationship-input"
              value={relationship}
              onChangeText={setRelationship}
              placeholder="Relationship (optional)"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <Pressable
              testID="contact-add-button"
              onPress={addContact}
              style={styles.addBtn}
            >
              <Feather name="plus" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.addBtnText}>Add contact</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Crisis resources</Text>
          {resources.map((r) => (
            <View key={r.name} style={styles.resourceCard}>
              <Feather name="phone-call" size={16} color={colors.brandSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resourceName}>{r.name}</Text>
                <Text style={styles.resourceContact}>{r.contact}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  close: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  checkCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  checkTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.xs },
  checkSub: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.lg, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, backgroundColor: colors.surface, minHeight: 46, marginBottom: spacing.sm },
  answerRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  answerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.pill, minHeight: 46 },
  answerYes: { backgroundColor: colors.brandPrimary },
  answerNo: { backgroundColor: colors.brandSecondary },
  answerText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },
  answered: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  answeredText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  sectionTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.md },
  contactCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  contactName: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.onSurface },
  contactMeta: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  delBtn: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  addBox: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, padding: 12, borderRadius: radius.pill, marginTop: spacing.sm },
  addBtnText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onBrandPrimary, fontWeight: "500" },
  resourceCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  resourceName: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.onSurface },
  resourceContact: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
});
