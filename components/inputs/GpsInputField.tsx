import { getCurrentLocation, formatGpsString } from "@/utils/locationHelper";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GpsInputFieldProps {
  onChange: (value: string) => void;
  value: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

// Captures the device's current GPS coordinates and stores them as a
// "latitude,longitude" string — the same format used by CameraInputField
// so values are consistent across the app.

export const GpsInputField = ({ onChange, value }: GpsInputFieldProps) => {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  const handleCapture = async () => {
    try {
      setCapturing(true);
      setError("");

      const coords = await getCurrentLocation();
      if (!coords) {
        setError("Could not get location. Check permissions and try again.");
        return;
      }

      const gpsString = formatGpsString(coords);
      console.log("[GpsInputField] Captured GPS:", gpsString);
      onChange(gpsString);
    } catch (err) {
      console.error("[GpsInputField] Error capturing GPS:", err);
      setError("Failed to capture location.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      {/* Capture button — disabled while waiting for GPS fix */}
      <Pressable
        className={`py-3 rounded-xl items-center ${capturing ? "bg-primary opacity-60" : "bg-primary active:opacity-80"}`}
        onPress={handleCapture}
        disabled={capturing}
      >
        {capturing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold">
            {value ? "Re-capture Location" : "Capture Location"}
          </Text>
        )}
      </Pressable>

      {/* Display captured coordinates or placeholder */}
      {value ? (
        <Text className="text-text font-mono text-sm text-center">{value}</Text>
      ) : (
        <Text className="text-textSecondary text-sm text-center italic">
          No location captured yet
        </Text>
      )}

      {/* Error message */}
      {!!error && <Text className="text-danger text-xs text-center">{error}</Text>}

    </View>
  );
};
