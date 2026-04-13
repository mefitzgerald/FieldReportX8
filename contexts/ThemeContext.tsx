import AsyncStorage from "@react-native-async-storage/async-storage";
import { sqliteHelper } from "@/utils/sqliteHelper";
import { vars } from "nativewind";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { View } from "react-native";
import { useColorScheme } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeName = "light" | "dark" | "forest" | "ocean";

interface ThemeContextValue {
  /** The currently active theme name */
  theme: ThemeName;
  /**
   * Change the theme and persist to AsyncStorage.
   * Pass firebaseUid to also write the preference to the User table.
   */
  setTheme: (theme: ThemeName, firebaseUid?: string) => Promise<void>;
  colours: typeof THEME_COLOURS[ThemeName];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "@fieldreportx/theme";

// Each theme is a set of CSS variable values injected via NativeWind's vars().
// These map to the Tailwind color tokens defined in tailwind.config.js.
// Changing the active theme swaps the entire variable set in one operation.
const THEME_VARS: Record<ThemeName, ReturnType<typeof vars>> = {
  light: vars({
    "--color-background": "#f8f9fa",
    "--color-surface": "#ffffff",
    "--color-primary": "#007AFF",
    "--color-text": "#1a1a1a",
    "--color-text-secondary": "#888888",
    "--color-border": "#e0e0e0",
    "--color-danger": "#FF3B30",
    "--color-tint": "#007AFF",
  }),
  dark: vars({
    "--color-background": "#1a1a1a",
    "--color-surface": "#2c2c2e",
    "--color-primary": "#0A84FF",
    "--color-text": "#ffffff",
    "--color-text-secondary": "#ababab",
    "--color-border": "#3a3a3c",
    "--color-danger": "#FF453A",
    "--color-tint": "#0A84FF",
  }),
  forest: vars({
    "--color-background": "#f0f4f0",
    "--color-surface": "#ffffff",
    "--color-primary": "#2d6a4f",
    "--color-text": "#1b2d1f",
    "--color-text-secondary": "#6b8c72",
    "--color-border": "#c8dfc8",
    "--color-danger": "#e63946",
    "--color-tint": "#2d6a4f",
  }),
  ocean: vars({
    "--color-background": "#e8f4f8",
    "--color-surface": "#ffffff",
    "--color-primary": "#0077b6",
    "--color-text": "#03045e",
    "--color-text-secondary": "#4a8fa8",
    "--color-border": "#b8d8e8",
    "--color-danger": "#e63946",
    "--color-tint": "#0077b6",
  }),
};

export const THEME_COLOURS: Record<ThemeName, {
  background: string;
  surface: string;
  primary: string;
  text: string;
  textSecondary: string;
  border: string;
  danger: string;
  tint: string;
  statusBar: "light" | "dark";
}> = {
  light:  { background: "#f8f9fa", surface: "#ffffff", primary: "#007AFF", text: "#1a1a1a", textSecondary: "#888888", border: "#e0e0e0", danger: "#FF3B30", tint: "#007AFF", statusBar: "dark"  },
  dark:   { background: "#1a1a1a", surface: "#2c2c2e", primary: "#0A84FF", text: "#ffffff", textSecondary: "#ababab", border: "#3a3a3c", danger: "#FF453A", tint: "#0A84FF", statusBar: "light" },
  forest: { background: "#f0f4f0", surface: "#ffffff", primary: "#2d6a4f", text: "#1b2d1f", textSecondary: "#6b8c72", border: "#c8dfc8", danger: "#e63946", tint: "#2d6a4f", statusBar: "dark"  },
  ocean:  { background: "#e8f4f8", surface: "#ffffff", primary: "#0077b6", text: "#03045e", textSecondary: "#4a8fa8", border: "#b8d8e8", danger: "#e63946", tint: "#0077b6", statusBar: "dark"  },
};

// Theme options exposed to the UI for the theme selector
export const THEME_OPTIONS: { label: string; value: ThemeName }[] = [
  { label: "Light",  value: "light"  },
  { label: "Dark",   value: "dark"   },
  { label: "Forest", value: "forest" },
  { label: "Ocean",  value: "ocean"  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();

  // null = no manual preference saved — follow the device theme reactively
  const [manualTheme, setManualTheme] = useState<ThemeName | null>(null);

  // Initialise immediately from the system scheme so there is no blank flash
  // before AsyncStorage resolves. manualTheme may override this once loaded.
  const [theme, setThemeState] = useState<ThemeName>(
    systemColorScheme === "dark" ? "dark" : "light"
  );

  // On mount: load any saved manual preference from AsyncStorage.
  // If none exists the app stays in system-following mode.
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in THEME_VARS) {
          console.log("[ThemeProvider] Loaded saved theme:", saved);
          setManualTheme(saved as ThemeName);
          setThemeState(saved as ThemeName);
        } else {
          console.log("[ThemeProvider] No saved theme — following system:", systemColorScheme);
        }
      })
      .catch((error) => console.error("[ThemeProvider] Failed to load theme:", error));
  }, []);

  // Reactively follow the device theme whenever no manual preference is set.
  // When the user has chosen a theme explicitly this effect does nothing.
  useEffect(() => {
    if (manualTheme === null) {
      const resolved = systemColorScheme === "dark" ? "dark" : "light";
      console.log("[ThemeProvider] System scheme changed, applying:", resolved);
      setThemeState(resolved);
    }
  }, [systemColorScheme, manualTheme]);

  // User explicitly picks a theme.
  // Always persists to AsyncStorage; also writes to the User table when
  // userId is provided — called from ThemeSelector via the settings screen.
  const setTheme = useCallback(async (newTheme: ThemeName, firebaseUid?: string) => {
    try {
      setManualTheme(newTheme);
      setThemeState(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      console.log("[ThemeProvider] Theme set to:", newTheme);
      if (firebaseUid) {
        const localUser = await sqliteHelper.user.getByFirebaseUid(firebaseUid);
        if (localUser?.userId) {
          await sqliteHelper.user.updateTheme(localUser.userId, newTheme);
          console.log("[ThemeProvider] Theme saved to User table for userId:", localUser.userId);
        }
      }
    } catch (error) {
      console.error("[ThemeProvider] Failed to save theme:", error);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colours: THEME_COLOURS[theme] }}>
      {/* vars() injects CSS variables as a style prop on this View.
          NativeWind reads these variables when resolving Tailwind classes
          like bg-background, text-text etc. on any descendant component.
          Using style prop instead of className avoids navigation remount issues. */}
      <View style={[{ flex: 1 }, THEME_VARS[theme]]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the current theme and setTheme action from anywhere inside <ThemeProvider>.
 *
 * @example
 * const { theme, setTheme } = useTheme();
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a <ThemeProvider>.");
  }
  return context;
}
