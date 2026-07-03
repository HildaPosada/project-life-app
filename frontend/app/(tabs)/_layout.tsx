import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 10,
          paddingBottom: 22,
        },
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 0.5, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Feather name="sun" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: "Journal",
          tabBarIcon: ({ color, size }) => <Feather name="book-open" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: "Journey",
          tabBarIcon: ({ color, size }) => <Feather name="compass" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Practices",
          tabBarIcon: ({ color, size }) => <Feather name="feather" size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
