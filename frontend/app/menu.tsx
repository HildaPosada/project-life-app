import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

const ITEMS: { title: string; icon: any; route: string }[] = [
  { title: "Home", icon: "home", route: "/(tabs)/home" },
  { title: "Vault", icon: "book", route: "/(tabs)/vault" },
  { title: "Journey", icon: "map", route: "/(tabs)/journey" },
  { title: "Practices", icon: "heart", route: "/(tabs)/library" },
  { title: "Safety Net", icon: "shield", route: "/safety" },
  { title: "Find a therapist", icon: "user-check", route: "/find-therapist" },
];

export default function MenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]} testID="menu-screen">
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="menu-close-button">
          <Feather name="x" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.appTitle}>Menu</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name?.charAt(0) ?? "?").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {ITEMS.map((it) => (
          <Pressable
            key={it.title}
            onPress={() => { router.back(); setTimeout(() => router.push(it.route as any), 50); }}
            style={styles.row}
            testID={`menu-item-${it.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <View style={styles.rowIcon}><Feather name={it.icon} size={18} color={colors.onSurface} /></View>
            <Text style={styles.rowText}>{it.title}</Text>
            <Feather name="chevron-right" size={18} color={colors.onSurfaceTertiary} />
          </Pressable>
        ))}

        <Pressable onPress={logout} style={styles.logout} testID="menu-logout-button">
          <Feather name="log-out" size={16} color={colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
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
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.body, fontSize: fontSize.lg, color: colors.onBrandPrimary, fontWeight: "700" },
  userName: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "600" },
  userEmail: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontFamily: fonts.body, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xxl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  logoutText: { fontFamily: fonts.body, fontSize: fontSize.base, color: colors.error, fontWeight: "500" },
});
