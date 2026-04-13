import { Accelerometer, Gyroscope } from "expo-sensors";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SensorData {
  x: number;
  y: number;
  z: number;
}

interface SensorInputFieldProps {
  onChange: (data: SensorData) => void;
  value: SensorData | null;
  type: "gyroscope" | "accelerometer";
}

// ─── Component ────────────────────────────────────────────────────────────────

// Captures gyroscope or accelerometer data depending on the type prop.
// Sampling runs until the user stops it — latest reading is stored in the form.

export const SensorInputField = ({
  onChange,
  value,
  type,
}: SensorInputFieldProps) => {
  const [isSampling, setIsSampling] = useState(false);
  const [subscription, setSubscription] = useState<{ remove: () => void } | null>(null);

  const Sensor = type === "gyroscope" ? Gyroscope : Accelerometer;

  // Clean up the sensor subscription when the component unmounts
  useEffect(() => {
    return () => {
      subscription?.remove();
    };
  }, [subscription]);

  const startSampling = () => {
    setIsSampling(true);
    Sensor.setUpdateInterval(100);
    const sub = Sensor.addListener((data) => onChange(data));
    setSubscription(sub);
  };

  const stopSampling = () => {
    subscription?.remove();
    setSubscription(null);
    setIsSampling(false);
  };

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      {/* Start / Stop button */}
      <TouchableOpacity
        className={`py-3 rounded-xl items-center ${isSampling ? "bg-danger" : "bg-primary"}`}
        onPress={isSampling ? stopSampling : startSampling}
      >
        <Text className="text-white font-bold">
          {isSampling ? `Stop Recording ${type}` : `Start Recording ${type}`}
        </Text>
      </TouchableOpacity>

      {/* Live readings */}
      {value ? (
        <View className="flex-row justify-around">
          <Text className="text-text font-mono text-sm">X: {value.x?.toFixed(2) ?? "0"}</Text>
          <Text className="text-text font-mono text-sm">Y: {value.y?.toFixed(2) ?? "0"}</Text>
          <Text className="text-text font-mono text-sm">Z: {value.z?.toFixed(2) ?? "0"}</Text>
        </View>
      ) : (
        <Text className="text-textSecondary text-sm text-center italic">No data captured yet</Text>
      )}

      {/* Sampling indicator */}
      {isSampling && <ActivityIndicator size="small" color="#007AFF" />}

    </View>
  );
};
