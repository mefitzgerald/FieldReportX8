import { useTheme, THEME_COLOURS } from "@/contexts/ThemeContext";
import { router } from "expo-router";
import { Image, Pressable, StatusBar, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  /** The screen title shown on the right of the logo */
  title: string;
  /** Whether to show a back button — defaults to true */
  showBack?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

// Consistent header used across all non-tab screens.
// Shows the app logo on the left and the screen title beside it.
// Optionally shows a back chevron to navigate back.

export function ScreenHeader({ title, showBack = true }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const colours = THEME_COLOURS[theme];

  return (
    <View
      style={{ 
        backgroundColor: colours.background, 
        borderBottomColor: colours.border,
        paddingTop: StatusBar.currentHeight ?? 0, // accounts for Android status bar height
      }}
      className="flex-row items-center px-4 py-3 border-b"
    >
      {/* Back button — navigates to the previous screen */}
      {showBack && (
        <Pressable
          className="mr-3 active:opacity-50"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colours.tint} />
        </Pressable>
      )}

      {/* App logo */}
      <Image
        source={require("@/assets/images/reportXlogo.png")}
        style={{ width: 28, height: 28 }}
        resizeMode="contain"
      />

      {/* Screen title */}
      <Text
        style={{ color: colours.text }}
        className="text-lg font-bold ml-2"
      >
        {title}
      </Text>
    </View>
  );
}
