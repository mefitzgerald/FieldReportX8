import { ThemeSelector } from "@/components/ThemeSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { storageHelper } from "@/utils/storageHelper";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  // Pull auth actions from context — logout clears Firebase session and
  // AsyncStorage cache, deleteAccount also removes the SQLite user record
  const { user, logout, deleteAccount } = useAuth();
  // Pull the current theme from context to set the StatusBar style accordingly. Apparently
  // Android doesn't automatically switch the status bar text colour based on the background color like iOS does,
  // so we need to set it manually here. Also somtimes expo go just ignores this as its a butthead. When I switch to dev build it should be fine.
  const { theme } = useTheme();

  // ── Reminder state ────────────────────────────────────────────────────────

  // Whether the draft reminder is switched on
  const [reminderEnabled, setReminderEnabled] = useState(false);
  // Hours as a string so the TextInput can hold partial/invalid input while typing
  const [reminderHours, setReminderHours] = useState("24");
  // Validation message shown below the hours input
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Load saved reminder preferences from AsyncStorage when the screen mounts
  useEffect(() => {
    storageHelper.reminder.load().then((prefs) => {
      if (prefs) {
        setReminderEnabled(prefs.enabled);
        setReminderHours(String(prefs.hours));
      }
    });
  }, []);

  // Called when the toggle is flipped — saves immediately.
  // Toggling off also cancels any pending draft reminders that were already
  // scheduled with the OS. cancelAllScheduledNotificationsAsync only affects
  // locally scheduled notifications — it does not touch FCM push notifications.
  const handleToggleReminder = async (value: boolean) => {
    setReminderEnabled(value);
    const hours = parseInt(reminderHours, 10);
    await storageHelper.reminder.save({ enabled: value, hours: isNaN(hours) ? 24 : hours });
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("[Notifications] Draft reminders turned OFF — all pending reminders cancelled");
    } else {
      console.log(`[Notifications] Draft reminders turned ON — reminder set for ${isNaN(hours) ? 24 : hours}h after save`);
    }
  };

  // Called when the hours input loses focus — validates then saves
  const handleHoursBlur = async () => {
    const parsed = parseInt(reminderHours, 10);

    if (isNaN(parsed) || parsed < 1 || parsed > 72) {
      setHoursError("Please enter a whole number between 1 and 72");
      return;
    }

    // Clear any previous error and persist the valid value
    setHoursError(null);
    setReminderHours(String(parsed)); // normalise (strips decimals etc.)
    await storageHelper.reminder.save({ enabled: reminderEnabled, hours: parsed });
    console.log(`[Notifications] Reminder duration updated — ${parsed}h after save`);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  // Sign the user out of Firebase and clear their local session cache
  const handleLogout = async () => {
    try {
      await logout();
      console.log("[Settings] User logged out successfully");
    } catch (error) {
      console.error("[Settings] Logout failed:", error);
    }
  };

  // Permanently delete the Firebase account and all associated SQLite data.
  // Shows a confirmation alert first since this action cannot be undone.
  // Firebase may throw auth/requires-recent-login if the session is old —
  // in that case we ask the user to re-authenticate before trying again.
  const handleDeleteUser = async () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error: any) {
              if (error.code === "auth/requires-recent-login") {
                // Firebase security requirement — sensitive operations need
                // a recent login to protect against stolen session tokens
                Alert.alert(
                  "Please sign in again",
                  "For security, please log out and log back in before deleting your account."
                );
              } else {
                Alert.alert("Error", error.message ?? "Failed to delete account.");
              }
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    // bg-background uses the CSS variable --color-background from global.css
    // which automatically changes when the user selects a different theme
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style={theme === "dark" ? "light" : "dark"} />

      {/* ScrollView handles smaller screens where all rows might not fit */}
      <ScrollView contentContainerClassName="p-6 gap-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-text">Settings</Text>
        </View>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        {/* ThemeSelector lets the user pick between Light, Dark, Forest, Ocean.
            The selected theme is persisted in AsyncStorage and applied via
            a CSS class on the root View in _layout.tsx */}
        <View className="bg-surface rounded-2xl p-4 gap-2">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">
            Appearance
          </Text>
          <ThemeSelector firebaseUid={user?.uid} />
        </View>

        {/* ── Reminders ───────────────────────────────────────────────────── */}
        {/* When enabled, a local notification is scheduled via WorkManager each
            time the user saves a new draft report. The notification fires after
            the chosen number of hours to remind them to complete it. */}
        <View className="bg-surface rounded-2xl p-4 gap-4">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">
            Draft Reminders
          </Text>

          {/* Toggle row */}
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-text">Remind me about draft reports</Text>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
            />
          </View>

          {/* Hours input — only shown when reminders are enabled */}
          {reminderEnabled && (
            <View className="gap-1">
              <Text className="text-sm text-textSecondary">
                Remind me after how many hours?
              </Text>
              <TextInput
                className={`border rounded-xl px-4 py-3 text-base text-text bg-background ${
                  hoursError ? "border-danger" : "border-border"
                }`}
                value={reminderHours}
                onChangeText={(text) => {
                  setReminderHours(text);
                  setHoursError(null); // clear error while the user is typing
                }}
                onBlur={handleHoursBlur}   // validate and save when focus leaves
                keyboardType="numeric"
                maxLength={2}              // 1–72 is at most 2 digits
                placeholder="24"
                placeholderTextColor="#888"
              />
              {/* Validation error */}
              {hoursError && (
                <Text className="text-danger text-xs">{hoursError}</Text>
              )}
              <Text className="text-xs text-textSecondary">
                Enter a number between 1 and 72
              </Text>
            </View>
          )}
        </View>

        {/* ── Templates ───────────────────────────────────────────────────── */}
        {/* Template management — add downloads new JSON templates from Firebase
            Storage, delete removes existing templates and their fields */}
        <View className="bg-surface rounded-2xl overflow-hidden">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest px-4 pt-4 pb-2">
            Templates
          </Text>
          <SettingsRow
            label="Add Templates"
            onPress={() => router.push("/addtemplates")}
          />
          <SettingsRow
            label="Delete Templates"
            onPress={() => router.push("/deletetemplates")}
          />
        </View>

        {/* ── Developer ───────────────────────────────────────────────────── */}
        {/* Dev tools — DB viewer lets us inspect SQLite tables during development.
            This section can be hidden or removed before release. */}
        <View className="bg-surface rounded-2xl overflow-hidden">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest px-4 pt-4 pb-2">
            Developer
          </Text>
          <SettingsRow
            label="View Database"
            onPress={() => router.push("/dbviewer")}
          />
        </View>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <View className="bg-surface rounded-2xl overflow-hidden">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest px-4 pt-4 pb-2">
            Profile
          </Text>
          <SettingsRow
            label="User Profile"
            onPress={() => router.push("/profile")}
          />
          <SettingsRow
            label="Business Profile"
            onPress={() => router.push("/businessprofile")}
          />
        </View>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        {/* Destructive actions at the bottom following mobile UX conventions.
            Delete Account is styled in red via the destructive prop. */}
        <View className="bg-surface rounded-2xl overflow-hidden">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest px-4 pt-4 pb-2">
            Account
          </Text>
          <SettingsRow label="Logout" onPress={handleLogout} />
          <SettingsRow
            label="Delete Account"
            onPress={handleDeleteUser}
            destructive
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Settings Row ─────────────────────────────────────────────────────────────

// Reusable row component used throughout this screen.
// Each row has a label on the left, a chevron on the right, and a top border
// separator. Destructive rows render the label in the danger colour (red).

interface SettingsRowProps {
  label: string;
  onPress: () => void;
  /** If true renders the label in the theme danger colour */
  destructive?: boolean;
}

function SettingsRow({ label, onPress, destructive = false }: SettingsRowProps) {
  return (
    <Pressable
      // active:opacity-50 gives a visual press response without a separate
      // pressed state variable — handled entirely by Tailwind
      className="flex-row items-center justify-between px-4 py-4 border-t border-border active:opacity-50"
      onPress={onPress}
    >
      {/* Label — red for destructive actions, default text colour otherwise */}
      <Text className={destructive ? "text-danger text-base" : "text-text text-base"}>
        {label}
      </Text>
      {/* Chevron indicator */}
      <Text className="text-textSecondary text-lg">›</Text>
    </Pressable>
  );
}
