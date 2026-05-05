
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Link, Tabs, router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME_COLOURS, useTheme } from "@/contexts/ThemeContext";

const BADGE_KEY = "hasNewTemplate";


// ─── Component ────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { theme } = useTheme();
  const colours = THEME_COLOURS[theme];
  const insets = useSafeAreaInsets();
  const [hasNewTemplate, setHasNewTemplate] = useState(false);

  useEffect(() => {
    // Restore badge state persisted from a previous session
    AsyncStorage.getItem(BADGE_KEY).then((val) => {
      if (val === "true") setHasNewTemplate(true);
    });

    // Show badge when a new-template notification arrives while app is open
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.screen === "addtemplates") {
        setHasNewTemplate(true);
        AsyncStorage.setItem(BADGE_KEY, "true");
      }
    });

    return () => sub.remove();
  }, []);

  const handleTemplateBadgePress = () => {
    setHasNewTemplate(false);
    AsyncStorage.setItem(BADGE_KEY, "false");
    router.push("/addtemplates");
  };
  
  return (
    <>


      <Tabs
      screenOptions={{
        // Active tab icon and label colour
        tabBarActiveTintColor: colours.tint,
        // Inactive tab icon and label colour — 80 hex = 50% opacity
        tabBarInactiveTintColor: colours.text + "80",
        // Tab bar background and border colour
        tabBarStyle: {
          backgroundColor: colours.background,
          borderTopColor: colours.border,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
          height: 56 + insets.bottom,
        },
        // Header background and text colour
        headerStyle: { backgroundColor: colours.background },
        headerTintColor: colours.text,
        headerShown: true,
        // Custom header title — logo + app name shown on all tabs
        headerTitle: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image
              source={require("@/assets/images/reportXlogo.png")}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 17, fontWeight: "700", color: colours.text }}>
              FieldReportX
            </Text>
          </View>
        ),
      }}
      >
        {/* ── Home ──────────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home" size={24} color={color} />
            ),
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 15 }}>
                {/* New template badge — tapping navigates to add templates */}
                <Pressable onPress={handleTemplateBadgePress} style={{ padding: 4 }}>
                  {({ pressed }) => (
                    <View style={{ opacity: pressed ? 0.5 : 1 }}>
                      <Ionicons name="cloud-download-outline" size={24} color={colours.text} />
                      {hasNewTemplate && (
                        <View style={{
                          position: "absolute",
                          top: -1,
                          right: -1,
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: "#ef4444",
                        }} />
                      )}
                    </View>
                  )}
                </Pressable>

                {/* Info / about modal */}
                <Link href="/modal" asChild>
                  <Pressable style={{ padding: 4 }}>
                    {({ pressed }) => (
                      <Ionicons
                        name="information-circle-outline"
                        size={25}
                        color={colours.text}
                        style={{ opacity: pressed ? 0.5 : 1 }}
                      />
                    )}
                  </Pressable>
                </Link>
              </View>
            ),
          }}
        />

        {/* ── History ───────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color }) => (
              <Ionicons name="time-outline" size={24} color={color} />
            ),
          }}
        />

        {/* ── Settings ──────────────────────────────────────────────────── */}
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <Ionicons name="settings-outline" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}