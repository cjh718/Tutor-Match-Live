import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, useColorScheme, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Tabs, router } from "expo-router";
import { NotificationBellIcon } from "@/components/NotificationBellIcon";

export default function TutorTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/notifications")}
            style={{ marginRight: 16 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <NotificationBellIcon color={colors.foreground} size={22} />
          </Pressable>
        ),
        tabBarStyle: {
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarBackground: isIOS
          ? () => (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            )
          : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Feather name="search" size={size} color={color} />,
        }}
      />
      {/* HIDE my-bids tab */}
      <Tabs.Screen
        name="my-bids"
        options={{
          href: null,
          title: "My Active Bids",
          headerShown: true,
        }}
      />
      {/* HIDE accepted-bids tab */}
      <Tabs.Screen
        name="accepted-bids"
        options={{
          href: null,
          title: "Accepted Bids",
          headerShown: true,
        }}
      />
      {/* HIDE sessions tab */}
      <Tabs.Screen
        name="sessions"
        options={{
          href: null,
          title: "Scheduled Sessions",
          headerShown: true,
        }}
      />
      {/* HIDE completed tab */}
      <Tabs.Screen
        name="completed"
        options={{
          href: null,
          title: "Completed",
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
