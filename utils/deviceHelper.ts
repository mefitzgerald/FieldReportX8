import { Platform } from "react-native";

// ─── Samsung Detection ────────────────────────────────────────────────────────
//
// expo-print's Print.printAsync freezes on Samsung devices due to Samsung's
// custom Android print framework. This helper detects Samsung so callers can
// fall back to a share-based PDF flow instead of the native print dialog.
//
// To revert Samsung-specific behaviour: delete this file and remove all
// isSamsung() call sites in reportPdfGenerator.ts.

export const isSamsung = (): boolean => {
  if (Platform.OS !== "android") {
    console.log("[DeviceHelper] Not Android — isSamsung: false");
    return false;
  }

  // Platform.constants.Manufacturer is available on all Android versions
  // supported by Expo. Value is typically "samsung", "motorola", "google" etc.
  const manufacturer =
    (Platform.constants as any).Manufacturer?.toLowerCase() ?? "";

  const result = manufacturer === "samsung";
  console.log(
    `[DeviceHelper] Manufacturer: "${manufacturer}" — isSamsung: ${result}`,
  );
  return result;
};
