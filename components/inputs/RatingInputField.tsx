import { Pressable, Text, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RatingInputFieldProps {
  onChange: (value: number) => void;
  value: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

// Five numbered radio buttons (1–5). Tapping a button selects it and calls
// onChange with the numeric rating. The selected button is highlighted in the
// primary colour; unselected buttons show as bordered outlines.
// Only one value can be active at a time — onChange replaces the previous value.

export const RatingInputField = ({ onChange, value }: RatingInputFieldProps) => {
  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      <Text className="text-textSecondary text-sm text-center italic">
        {value ? `Rating: ${value} / 5` : "Select a rating"}
      </Text>

      {/* Five equally spaced buttons in a row */}
      <View className="flex-row justify-around">
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;
          return (
            <Pressable
              key={rating}
              // Selected: filled primary background. Unselected: bordered outline.
              className={`w-12 h-12 rounded-full items-center justify-center border-2 active:opacity-70
                ${selected ? "bg-primary border-primary" : "border-border bg-background"}`}
              onPress={() => {
                console.log("[RatingInputField] Selected rating:", rating);
                onChange(rating);
              }}
            >
              <Text className={`font-bold text-base ${selected ? "text-white" : "text-text"}`}>
                {rating}
              </Text>
            </Pressable>
          );
        })}
      </View>

    </View>
  );
};
