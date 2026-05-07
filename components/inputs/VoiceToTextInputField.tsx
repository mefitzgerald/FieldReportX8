import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceToTextInputFieldProps {
  onChange: (text: string) => void;
  value: string;
  placeholder?: string;
  language?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Joins previously saved text with the new transcript, separated by a space.
const joinText = (prefix: string, transcript: string) => {
  const a = prefix.trim();
  const b = transcript.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

// Combines a multiline text input with a microphone button for speech-to-text.
// The user can type freely or dictate — both update the same form value.

export const VoiceToTextInputField = ({
  onChange,
  value,
  placeholder = "Type or tap the microphone to dictate",
  language = "en-US",
}: VoiceToTextInputFieldProps) => {
  const [recognizing, setRecognizing] = useState(false);
  const [statusText, setStatusText] = useState(
    Platform.OS === "web" ? "Typing only" : "Ready"
  );
  const [errorText, setErrorText] = useState("");
  const [baseText, setBaseText] = useState("");

  // Tracks whether this specific instance started the current recognition session.
  // useSpeechRecognitionEvent listeners are global — every mounted VoiceToTextInputField
  // receives every event. This ref gates handlers so only the field that called
  // start() processes results and updates its state.
  const isActiveRef = useRef(false);

  const speechSupported = Platform.OS !== "web";

  // ── Speech recognition events ─────────────────────────────────────────────

  useSpeechRecognitionEvent("start", () => {
    if (!isActiveRef.current) return;
    setRecognizing(true);
    setStatusText("Listening...");
    setErrorText("");
  });

  useSpeechRecognitionEvent("end", () => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    setRecognizing(false);
    setStatusText("Stopped");
    setBaseText("");
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!isActiveRef.current) return;
    const transcript = event.results?.[0]?.transcript ?? "";
    if (!transcript) return;
    onChange(joinText(baseText, transcript));
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    setRecognizing(false);
    setStatusText("Error");
    setErrorText(`${event.error}: ${event.message ?? "Unknown error"}`);
    setBaseText("");
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!speechSupported) {
      setStatusText("Unavailable");
      setErrorText("Speech recognition is not supported on this platform.");
      return;
    }

    try {
      setStatusText("Requesting permissions...");
      setErrorText("");

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setStatusText("Permission denied");
        setErrorText("Microphone and speech permission was not granted.");
        return;
      }

      setBaseText(value ?? "");
      setStatusText("Starting...");
      isActiveRef.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      setRecognizing(false);
      setStatusText("Error");
      setErrorText(`Failed to start speech recognition: ${String(error)}`);
    }
  };

  const handleStop = () => {
    setStatusText("Stopping...");
    ExpoSpeechRecognitionModule.stop();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-2">

      {/* Text input + mic button side by side */}
      <View className="flex-row items-end gap-3">
        <TextInput
          className={`flex-1 min-h-[120px] border rounded-xl px-4 py-3 text-base text-text bg-background ${
            recognizing ? "border-primary" : errorText ? "border-danger" : "border-border"
          }`}
          placeholder={placeholder}
          placeholderTextColor="#888"
          onChangeText={onChange}
          value={value}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Mic button — red while recording, blue when idle */}
        <Pressable
          className={`w-12 h-12 rounded-full items-center justify-center ${
            !speechSupported ? "bg-gray-400" : recognizing ? "bg-danger" : "bg-primary"
          }`}
          onPress={recognizing ? handleStop : handleStart}
          disabled={!speechSupported}
        >
          <Ionicons name={recognizing ? "stop" : "mic"} size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Status line */}
      <Text className="text-textSecondary text-xs">{statusText}</Text>

      {/* Error message */}
      {!!errorText && (
        <Text className="text-danger text-xs">{errorText}</Text>
      )}

    </View>
  );
};
