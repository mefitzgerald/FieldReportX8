import { Ionicons } from "@expo/vector-icons";
import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

// The shape saved to the form and SQLite when the user captures a reading.
// Pitch = front/back tilt, Roll = left/right tilt. Both in degrees.
export interface TiltReading {
  pitch: number;
  roll: number;
  capturedAt: string;
}

interface TiltAngleInputFieldProps {
  onChange: (value: TiltReading | null) => void;
  value: TiltReading | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convert raw accelerometer x/y/z values to pitch and roll in degrees.
// The accelerometer returns values in g-force units where gravity = ~1.
// When the phone lies flat: x ≈ 0, y ≈ 0, z ≈ 1.
//
// atan2 gives the angle in radians — multiply by 180/π to get degrees.
// We clamp to 1 decimal place for a clean display.
const calcAngles = (x: number, y: number, z: number) => {
  const pitch = Math.atan2(x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
  const roll  = Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
  return {
    pitch: Math.round(pitch * 10) / 10,
    roll:  Math.round(roll  * 10) / 10,
  };
};

// Returns true if both angles are within ±2° — close enough to be considered level.
const isLevel = (pitch: number, roll: number) =>
  Math.abs(pitch) <= 2 && Math.abs(roll) <= 2;

// ─── Sub-component: angle bar ─────────────────────────────────────────────────

// Visual indicator — a horizontal bar with a marker that shifts left/right
// based on the angle. Green when level, amber when tilted.
const AngleBar = ({ angle, label }: { angle: number; label: string }) => {
  // Clamp angle to ±45° for the bar display — beyond that the marker
  // sits at the edge. Max range is ±45° mapped to 0–100% bar width.
  const clamped = Math.max(-45, Math.min(45, angle));
  // Convert to a 0–1 position (0.5 = centre = level)
  const position = (clamped + 45) / 90;
  const level = Math.abs(angle) <= 2;

  return (
    <View className="gap-1">
      <Text className="text-xs text-textSecondary">{label}</Text>
      {/* Track */}
      <View className="h-5 bg-border rounded-full overflow-hidden relative">
        {/* Centre line — reference for level */}
        <View
          className="absolute top-0 bottom-0 w-px bg-textSecondary opacity-40"
          style={{ left: "50%" }}
        />
        {/* Moving marker */}
        <View
          className={`absolute top-1 bottom-1 w-3 rounded-full ${
            level ? "bg-green-500" : "bg-amber-400"
          }`}
          style={{
            left: `${position * 100}%`,
            transform: [{ translateX: -6 }],
          }}
        />
      </View>
      {/* Numeric readout */}
      <Text
        className={`text-xs text-right font-mono ${
          level ? "text-green-500" : "text-amber-500"
        }`}
      >
        {angle > 0 ? "+" : ""}{angle}°
      </Text>
    </View>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const TiltAngleInputField = ({
  onChange,
  value,
}: TiltAngleInputFieldProps) => {
  // Live pitch and roll calculated from the accelerometer stream
  const [livePitch, setLivePitch] = useState(0);
  const [liveRoll,  setLiveRoll]  = useState(0);

  // Whether the accelerometer subscription is currently active
  const [measuring, setMeasuring] = useState(false);

  // Keep a ref to the subscription so we can unsubscribe cleanly
  const subscriptionRef = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);

  // Clean up the accelerometer subscription when the component unmounts.
  // Without this, the listener keeps firing after the field is gone.
  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  // ── Start measuring ──────────────────────────────────────────────────────

  const handleStart = () => {
    // Sample the accelerometer 10 times per second — fast enough for a
    // smooth live display without draining the battery.
    Accelerometer.setUpdateInterval(100);

    subscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const { pitch, roll } = calcAngles(x, y, z);
      setLivePitch(pitch);
      setLiveRoll(roll);
    });

    setMeasuring(true);
  };

  // ── Stop and discard ─────────────────────────────────────────────────────

  const handleStop = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setMeasuring(false);
  };

  // ── Capture the current reading ──────────────────────────────────────────

  const handleCapture = () => {
    // Stop the live feed first so the reading doesn't jump after capture
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setMeasuring(false);

    // Save the frozen reading to the form. capturedAt lets the PDF show
    // when the measurement was taken.
    onChange({
      pitch: livePitch,
      roll:  liveRoll,
      capturedAt: new Date().toISOString(),
    });
  };

  // ── Clear a saved reading ────────────────────────────────────────────────

  const handleClear = () => {
    onChange(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-4">

      {/* ── Live measurement view ─────────────────────────────────────────── */}
      {measuring && (
        <View className="gap-3">
          {/* Level indicator badge */}
          <View className="flex-row items-center gap-2">
            <View
              className={`w-3 h-3 rounded-full ${
                isLevel(livePitch, liveRoll) ? "bg-green-500" : "bg-amber-400"
              }`}
            />
            <Text className="text-sm font-medium text-text">
              {isLevel(livePitch, liveRoll) ? "Level" : "Not level"}
            </Text>
          </View>

          {/* Visual bars for pitch and roll */}
          <AngleBar angle={livePitch} label="Pitch (front / back)" />
          <AngleBar angle={liveRoll}  label="Roll (left / right)"  />

          {/* Capture and cancel buttons */}
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 bg-primary rounded-xl py-3 items-center"
              onPress={handleCapture}
            >
              <Text className="text-white font-semibold text-sm">
                Capture Angle
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 border border-border rounded-xl py-3 items-center"
              onPress={handleStop}
            >
              <Text className="text-text text-sm">Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Saved reading view ────────────────────────────────────────────── */}
      {!measuring && value && (
        <View className="gap-3">
          <Text className="text-xs text-textSecondary">
            Captured {new Date(value.capturedAt).toLocaleString()}
          </Text>

          {/* Saved pitch and roll values */}
          <View className="flex-row gap-4">
            <View className="flex-1 bg-background border border-border rounded-lg p-3 items-center">
              <Text className="text-xs text-textSecondary mb-1">Pitch</Text>
              <Text className="text-lg font-bold text-text font-mono">
                {value.pitch > 0 ? "+" : ""}{value.pitch}°
              </Text>
              <Text className="text-xs text-textSecondary">front / back</Text>
            </View>
            <View className="flex-1 bg-background border border-border rounded-lg p-3 items-center">
              <Text className="text-xs text-textSecondary mb-1">Roll</Text>
              <Text className="text-lg font-bold text-text font-mono">
                {value.roll > 0 ? "+" : ""}{value.roll}°
              </Text>
              <Text className="text-xs text-textSecondary">left / right</Text>
            </View>
          </View>

          {/* Level result badge */}
          <View
            className={`rounded-lg py-2 items-center ${
              isLevel(value.pitch, value.roll) ? "bg-green-500" : "bg-amber-400"
            }`}
          >
            <Text className="text-white font-semibold text-sm">
              {isLevel(value.pitch, value.roll)
                ? "Surface is level"
                : "Surface is not level"}
            </Text>
          </View>

          {/* Re-measure and clear buttons */}
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 bg-primary rounded-xl py-3 items-center"
              onPress={handleStart}
            >
              <Text className="text-white font-semibold text-sm">
                Re-measure
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 border border-border rounded-xl py-3 items-center"
              onPress={handleClear}
            >
              <Text className="text-text text-sm">Clear</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Idle view — no saved reading, not measuring ───────────────────── */}
      {!measuring && !value && (
        <Pressable
          className="flex-row items-center justify-center gap-3 py-4 border border-dashed border-border rounded-xl"
          onPress={handleStart}
        >
          <Ionicons name="compass-outline" size={22} color="#888" />
          <Text className="text-textSecondary text-sm">
            Tap to measure tilt angle
          </Text>
        </Pressable>
      )}

    </View>
  );
};
