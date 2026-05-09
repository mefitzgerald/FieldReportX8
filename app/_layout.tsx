// react-native-reanimated must be imported before LogBox to avoid initialisation
// order issues on Android.
import { LogBox } from "react-native";
import "../global.css";

// Suppress a false-positive warning that Skia and Gesture Handler internally
// trigger in Reanimated. LogBox removes the in-app yellow overlay; the
// console.warn patch removes it from the Metro terminal output too.
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

// Re-export Expo Router's default error boundary so the framework can catch
// and display navigation errors without a blank screen.
export { ErrorBoundary } from "expo-router";

// Tell Expo Router which route to show first if no deep-link is active.
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding — we hide it manually once fonts
// AND the database are both ready (see the useEffect in RootLayout below).
SplashScreen.preventAutoHideAsync();

// ─── Root Layout ──────────────────────────────────────────────────────────────
//
// This is the first component Expo Router mounts. Its job is purely setup:
//   1. Load custom fonts
//   2. Initialise the SQLite database
//   3. Keep the splash screen visible until both are done
//   4. Mount the global providers (theme, auth, gesture handler)
//
// Navigation and auth-gating live in RootLayoutNav (below), kept separate so
// it can call useAuth() and useTheme() after their providers are mounted.

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Throw font load errors into the nearest ErrorBoundary rather than silently failing.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Initialise SQLite once on mount — creates tables if they don't exist yet.
  useEffect(() => {
    sqliteHelper
      .initialise()
      .then(() => setDbReady(true))
      .catch((e) => console.error("[RootLayout] DB init failed:", e));
  }, []);

  // Hide the splash screen only when BOTH fonts and the DB are ready.
  // Waiting for both prevents a flash where the UI renders before data is accessible.
  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  // Return null (keeping the splash visible) until setup is complete.
  if (!loaded || !dbReady) {
    return null;
  }

  return (
    // GestureHandlerRootView must wrap the entire app — Gesture Handler requires
    // it as an ancestor for pan, pinch, and tap gestures to work on Android.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ThemeProvider injects CSS variables via NativeWind's vars() so
          className colours like "bg-background" resolve to the correct value */}
      <ThemeProvider>
        {/* AuthProvider wraps everything so any screen can call useAuth() */}
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// ─── Root Layout Nav ──────────────────────────────────────────────────────────
//
// Separated from RootLayout so it can call useAuth() and useTheme() — both
// hooks require their providers to already be mounted above them in the tree.
//
// Responsibilities:
//   - Keep the splash visible while Firebase resolves the auth state on startup
//   - Sync the Android system navigation bar colour with the active theme
//   - Declare all app screens and guard them based on login state

function RootLayoutNav() {
  const { theme } = useTheme();
  const { isLoggedIn, isLoading } = useAuth();

  // Resolve the full colour palette for the current theme (light or dark).
  const colours = THEME_COLOURS[theme];

  // Firebase + AsyncStorage need an async round-trip to restore the session on
  // startup. Keep the splash visible during that window so the user never sees
  // a half-loaded screen or an incorrect redirect.
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Keep the Android system navigation bar (bottom gesture bar) in sync with
  // the active theme — background colour and icon brightness both update.
  // TODO Update this to use the new Expo NavigationBar API once it's out of beta,
  // which should be more reliable across Android versions and manufacturers.
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(colours.background);
    NavigationBar.setButtonStyleAsync(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <>
      {/* StatusBar sits here (not in RootLayout) so it re-renders whenever the
          theme changes. transparent background lets the app colour show through;
          style sets icon/text brightness — light icons on dark, dark on light. */}
      <StatusBar style={colours.statusBar} />

      {/* NavThemeProvider gives React Navigation's built-in header and tab bar
          the correct base colours for the active theme. */}
      <NavThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* Unauthenticated routes — only reachable when the user is logged out.
              Expo Router redirects away from these automatically once isLoggedIn is true. */}
          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>

          {/* Authenticated routes — only reachable when the user is logged in.
              Expo Router redirects to login automatically when isLoggedIn is false. */}
          <Stack.Protected guard={isLoggedIn}>
            {/* Main tab navigator */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* About modal — slides up from the bottom */}
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "About" }}
            />
            {/* Internal DB viewer for debugging */}
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
