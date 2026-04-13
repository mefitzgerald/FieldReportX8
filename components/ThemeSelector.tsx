import { THEME_OPTIONS, ThemeName, useTheme } from "@/contexts/ThemeContext";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ThemeSelectorProps {
  /** Firebase UID — passed to setTheme so it can persist the choice to the User table */
  firebaseUid?: string;
}

export function ThemeSelector({ firebaseUid }: ThemeSelectorProps) {
  const { theme, setTheme, colours } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colours.textSecondary }]}>Theme</Text>
      <View style={styles.options}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.option,
              { borderColor: colours.border },
              theme === option.value && { backgroundColor: colours.tint, borderColor: colours.tint },
            ]}
            onPress={() => setTheme(option.value as ThemeName, firebaseUid)}
          >
            <Text
              style={[
                styles.optionText,
                { color: colours.text },
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