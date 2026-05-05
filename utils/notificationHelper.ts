import { db } from "@/firebaseConfig";
import * as Notifications from "expo-notifications";
import { doc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

// Show alerts and play sound for notifications received while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const registerForPushNotifications = async (firebaseUid: string): Promise<void> => {
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
