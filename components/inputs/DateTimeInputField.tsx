import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateTimeInputFieldProps {
  onChange: (value: string) => void;
  value: string;
  mode: "date" | "time";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Formats a DateTime object into a human-readable string for display and storage.
// Date mode: "12 Apr 2026"   Time mode: "14:30"
const formatValue = (DateTime: Date, mode: "date" | "time"): string => {
  if (mode === "time") {
    return DateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return DateTime.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

// ─── Component ────────────────────────────────────────────────────────────────

// On Android, DateTimePicker is not an inline component — it opens as a native
// dialog. We control this with showPicker state: pressing the button shows the
// dialog, and the picker's onChange fires once the user confirms or dismisses.
// The selected value is stored as a formatted string (not a Date object) so it
// can be saved to SQLite directly without serialisation concerns.

export const DateTimeInputField = ({ onChange, value, mode }: DateTimeInputFieldProps) => {
  const [showPicker, setShowPicker] = useState(false);

  // Parse the stored string back to a DateTime for the picker's initial value.
  // Falls back to now if the stored value is missing or unparseable.
  const storedDateTime = value ? new Date(value) : new Date();
  const isValid = !isNaN(storedDateTime.getTime());
  const pickerDateTime = isValid ? storedDateTime : new Date();

  const handleChange = (_event: DateTimePickerEvent, selectedDateTime?: Date) => {
    // On Android, onChange fires on both confirm and dismiss.
    // Always hide the picker first, then save the value if one was selected.
    setShowPicker(false);
    if (!selectedDateTime) return;

    const formatted = formatValue(selectedDateTime, mode);
    console.log(`[DateTimeInputField] ${mode} selected:`, formatted);
    onChange(formatted);
  };

  const label = mode === "date" ? "Select Date" : "Select Time";
  const placeholder = mode === "date" ? "No date selected" : "No time selected";

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      {/* Show the current value or a placeholder */}
      {value ? (
        <Text className="text-text text-base text-center font-medium">{value}</Text>
      ) : (
        <Text className="text-textSecondary text-sm text-center italic">{placeholder}</Text>
      )}

      {/* Button to open the native picker dialog */}
      <Pressable
        className="py-3 rounded-xl items-center bg-primary active:opacity-80"
        onPress={() => setShowPicker(true)}
      >
        <Text className="text-white font-bold">{label}</Text>
      </Pressable>

      {/* Native picker — only rendered when open. On Android this appears as a
          modal dialog, so it doesn't take up space in the layout when hidden. */}
      {showPicker && (
        <DateTimePicker
          value={pickerDateTime}
          mode={mode}
          display="default"
          onChange={handleChange}
        />
      )}

    </View>
  );
};
