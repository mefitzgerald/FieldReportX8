// Used in the Settings screen to let the user pick between available themes.
// Uses StyleSheet rather than NativeWind because the active colours come from
// ThemeContext at runtime — NativeWind classNames are resolved at build time
// and can't reference dynamic colour values.
import { THEME_OPTIONS, ThemeName, useTheme } from "@/contexts/ThemeContext";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ThemeSelectorProps {
  // Firebase UID — passed to setTheme so it can persist the chosen theme
  // to the User table in SQLite alongside the Firebase record.
  firebaseUid?: string;
}

// Renders a row of pill buttons, one per available theme.
// The active theme's pill is highlighted with the tint colour.
// Tapping a pill calls setTheme which updates the context and persists the choice.
export function ThemeSelector({ firebaseUid }: ThemeSelectorProps) {
  const { theme, setTheme, colours } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colours.textSecondary }]}>
        Themes
      </Text>
      <View style={styles.options}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.option,
              { borderColor: colours.border },
              // Highlight the currently active theme pill
              theme === option.value && {
                backgroundColor: colours.tint,
                borderColor: colours.tint,
              },
            ]}
            onPress={() => setTheme(option.value as ThemeName, firebaseUid)}
          >
            <Text
              style={[
                styles.optionText,
                { color: colours.text },
                // White bold text on the active pill for contrast
                theme === option.value && { color: "#fff", fontWeight: "600" },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 16, paddingHorizontal: 16 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  option: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  optionText: { fontSize: 14 },
});
