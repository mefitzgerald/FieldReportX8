import { ThemeSelector } from "@/components/ThemeSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { storageHelper } from "@/utils/storageHelper";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
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
  // Selected reminder duration in hours — one of the preset pill values
  const [reminderHours, setReminderHours] = useState(24);

  // Preset duration options (in hours) shown as selectable pills.
  // These cover the most common reminder intervals — 1h for urgent,
  // up to 48h for reports that can wait until the next day.
  const REMINDER_OPTIONS = [1, 2, 4, 8, 24, 48];

  // Load saved reminder preferences from AsyncStorage when the screen mounts
  useEffect(() => {
    storageHelper.reminder.load().then((prefs) => {
      if (prefs) {
        setReminderEnabled(prefs.enabled);
        setReminderHours(prefs.hours);
      }
    });
  }, []);

  // Called when the toggle is flipped — saves immediately.
  // Toggling off also cancels any pending draft reminders that were already
  // scheduled with the OS. cancelAllScheduledNotificationsAsync only affects
  // locally scheduled notifications — it does not touch FCM push notifications.
  const handleToggleReminder = async (value: boolean) => {
    setReminderEnabled(value);
    await storageHelper.reminder.save({ enabled: value, hours: reminderHours });
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log(
        "[Notifications] Draft reminders turned OFF — all pending reminders cancelled",
      );
    } else {
      console.log(
        `[Notifications] Draft reminders turned ON — reminder set for ${reminderHours}h after save`,
      );
    }
  };

  // Called when the user taps a duration pill.
  // Saves immediately — no validation needed since the options are fixed values.
  // The reminder toggle state is preserved; only the duration changes.
  const handleSelectHours = async (hours: number) => {
    setReminderHours(hours);
    await storageHelper.reminder.save({ enabled: reminderEnabled, hours });
    console.log(
      `[Notifications] Reminder duration updated — ${hours}h after save`,
    );
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
                  "For security, please log out and log back in before deleting your account.",
                );
              } else {
                Alert.alert(
                  "Error",
                  error.message ?? "Failed to delete account.",
                );
              }
            }
          },
        },
      ],
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
            <Text className="text-base text-text">
              Remind me about draft reports
            </Text>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
            />
          </View>

          {/* Duration pills — only shown when reminders are enabled.
              The currently selected duration is highlighted in primary colour.
              Tapping a pill calls handleSelectHours which saves to AsyncStorage
              immediately so the preference survives app restarts. */}
          {reminderEnabled && (
            <View className="gap-2">
              <Text className="text-sm text-textSecondary">
                Remind me after how many hours?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {REMINDER_OPTIONS.map((hours) => (
                  <Pressable
                    key={hours}
                    className={`border rounded-full py-1.5 px-4 ${
                      reminderHours === hours
                        ? "bg-primary border-primary" // active — filled
                        : "border-border" // inactive — outline only
                    }`}
                    onPress={() => handleSelectHours(hours)}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        reminderHours === hours ? "text-white" : "text-text"
                      }`}
                    >
                      {hours}h
                    </Text>
                  </Pressable>
                ))}
              </View>
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

function SettingsRow({
  label,
  onPress,
  destructive = false,
}: SettingsRowProps) {
  return (
    <Pressable
      // active:opacity-50 gives a visual press response without a separate
      // pressed state variable — handled entirely by Tailwind
      className="flex-row items-center justify-between px-4 py-4 border-t border-border active:opacity-50"
      onPress={onPress}
    >
      {/* Label — red for destructive actions, default text colour otherwise */}
      <Text
        className={
          destructive ? "text-danger text-base" : "text-text text-base"
        }
      >
        {label}
      </Text>
      {/* Chevron indicator */}
      <Text className="text-textSecondary text-lg">›</Text>
    </Pressable>
  );
}
