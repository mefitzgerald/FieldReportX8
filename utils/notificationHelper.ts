import { db } from "@/firebaseConfig";
import * as Notifications from "expo-notifications";
import { doc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

// Show alerts and play sound for notifications received while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Schedules a one-shot local notification to remind the user to complete a
 * draft report, firing `hours` hours after this function is called.
 *
 * How it works — the WorkManager layer:
 * ─────────────────────────────────────────────────────────────────────────────
 * expo-notifications calls Android's AlarmManager (for exact timing) or
 * WorkManager (for battery-optimised delivery) depending on the device and
 * Android version. Either way, the timer lives entirely inside the Android OS
 * once this function returns — your app does not need to stay running, and the
 * notification will still fire even if the user force-stops the app or the
 * device restarts.
 *
 * On iOS the equivalent is UNUserNotificationCenter — same guarantee.
 *
 * The returned identifier string can be passed to
 * Notifications.cancelScheduledNotificationAsync(id) if you ever want to
 * cancel a pending reminder before it fires.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const scheduleDraftReminder = async (
  hours: number,
): Promise<string | null> => {
  // Notification permission must be granted or the OS will reject the schedule
  // request. We already request permission in registerForPushNotifications on
  // login, so this will normally be granted — this check is a safety guard.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    console.log(
      "[Notifications] Cannot schedule reminder — permission not granted",
    );
    return null;
  }

  // TimeIntervalTrigger tells the OS to fire the notification after a set
  // number of seconds. repeats: false means it fires once and is done —
  // it will not repeat like an alarm clock.   const seconds = hours * 60 * 60;
  const seconds = hours * 60 * 60;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Draft Report Reminder",
      body: "You have a draft report waiting to be completed.",
      // The data payload travels with the notification and is available in
      // notification listeners. We use screen: "history" so the tap handler
      // in _layout.tsx knows to navigate the user to the History tab.
      data: { screen: "history" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    },
  });

  console.log(
    `[Notifications] Draft reminder scheduled in ${hours}h (id: ${identifier})`,
  );
  return identifier;
};

export const registerForPushNotifications = async (
  firebaseUid: string,
): Promise<void> => {
  if (Platform.OS !== "android") return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission denied");
    return;
  }

  const { data: token } = await Notifications.getDevicePushTokenAsync();

  console.log("[Notifications] FCM token:", token);

  await setDoc(doc(db, "pushTokens", firebaseUid), {
    token,
    updatedAt: new Date().toISOString(),
  });
};
