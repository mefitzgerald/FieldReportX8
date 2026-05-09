import { LogBox } from "react-native";
import "../global.css";

// Suppress false-positive Reanimated warning triggered by Skia/Gesture Handler internals.
// LogBox suppresses the in-app overlay; the console.warn filter suppresses Metro output.
LogBox.ignoreLogs(["It looks like you might be using shared value"]);
const _warn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("shared value")) return;
  _warn(...args);
};

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  THEME_COLOURS,
  ThemeProvider,
  useTheme,
} from "@/contexts/ThemeContext";
import { sqliteHelper } from "@/utils/sqliteHelper";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Hold the splash screen until ALL async setup is complete
SplashScreen.preventAutoHideAsync();

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Throw font errors into the nearest ErrorBoundary
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Initialise SQLite once on mount
  useEffect(() => {
    sqliteHelper
      .initialise()
      .then(() => setDbReady(true))
      .catch((e) => console.error("[RootLayout] DB init failed:", e));
  }, []);

  // Hide the splash screen only when BOTH fonts and DB are ready
  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  // Keep showing the splash screen until everything is ready
  if (!loaded || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ThemeProvider injects CSS variables via NativeWind's vars() */}
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// ─── Root Layout Nav ──────────────────────────────────────────────────────────

// Separate component so it can access both useAuth() and useTheme()
// which require their providers to be mounted above them in the tree

function RootLayoutNav() {
  const { theme } = useTheme();
  const { isLoggedIn, isLoading } = useAuth();

  // Get the full colour set for the current theme
  const colours = THEME_COLOURS[theme];

  // Keep splash visible while Firebase + AsyncStorage resolve auth state
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Sync the system navigation bar colour and button style with the active theme
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(colours.background);
    NavigationBar.setButtonStyleAsync(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <>
      {/* StatusBar here so it updates whenever the theme changes.
          backgroundColor transparent lets the app background show through.
          style controls the icon/text colour — light on dark themes, dark on light. */}
      <StatusBar style={colours.statusBar} />

      {/* NavThemeProvider controls React Navigation's header and tab bar base theme */}
      <NavThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal", title: "About" }} />
            <Stack.Screen name="dbviewer" options={{ headerShown: false }} />
            <Stack.Screen
              name="addtemplates"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="report" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen
              name="businessprofile"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="compare" options={{ headerShown: false }} />
            <Stack.Screen
              name="deletetemplates"
              options={{ headerShown: false }}
            />
          </Stack.Protected>
        </Stack>
      </NavThemeProvider>
    </>
  );
}
