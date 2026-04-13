import {
  Canvas,
  Path,
  Skia,
  Text as SkiaText,
  useFont,
  Rect,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { File, Paths } from "expo-file-system/next";
import { useRef, useState } from "react";
import { Dimensions, Image, Pressable, Text, View } from "react-native";

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = Dimensions.get("window").width - 48; // account for px-5 padding + gap
const CANVAS_HEIGHT = 180;
const STROKE_COLOR = "#000000";
const STROKE_WIDTH = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignatureInputFieldProps {
  onChange: (uri: string) => void;
  value: string; // file:// URI of saved signature image, or ""
}

// ─── Component ────────────────────────────────────────────────────────────────

// A freehand signature pad built with Skia.
// The user draws with their finger, then taps "Save Signature" which:
//   1. Captures the canvas as a bitmap (makeImageSnapshot)
//   2. Writes it to app document storage as a .png file
//   3. Calls onChange with the file:// URI for SQLite storage
// The human-readable timestamp is embedded as Skia text before snapshot,
// so it is permanently baked into the saved image.

export const SignatureInputField = ({ onChange, value }: SignatureInputFieldProps) => {
  // Each stroke is a separate Skia path so we can track them individually.
  // currentPath is the in-progress stroke; paths is the list of completed ones.
  const [paths, setPaths] = useState<ReturnType<typeof Skia.Path.Make>[]>([]);
  const [currentPath, setCurrentPath] = useState<ReturnType<typeof Skia.Path.Make> | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // canvasRef lets us call makeImageSnapshot() on the canvas imperatively
  const canvasRef = useRef(null);

  // Load SpaceMono for rendering the timestamp text on the Skia canvas.
  // useFont must be called unconditionally (React hook rules) — the SkiaText
  // component is only rendered once the font is loaded (font !== null).
  const font = useFont(require("@/assets/fonts/SpaceMono-Regular.ttf"), 10);

  // Human-readable timestamp baked into the bottom of the signature image
  const timestamp = new Date().toLocaleString();

  // ── Gesture ───────────────────────────────────────────────────────────────

  // Pan gesture tracks finger movement across the canvas.
  // runOnJS(true) is required because Skia state updates must happen on the JS thread.
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      // Start a new path at the touch point
      const path = Skia.Path.Make();
      path.moveTo(e.x, e.y);
      setCurrentPath(path);
      setIsDrawing(true);
    })
    .onUpdate((e) => {
      if (!currentPath) return;
      // Draw a line to each new touch position
      const updated = currentPath.copy();
      updated.lineTo(e.x, e.y);
      setCurrentPath(updated);
    })
    .onEnd(() => {
      // Commit the completed stroke to the paths list
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
      }
      setCurrentPath(null);
      setIsDrawing(false);
    });

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = () => {
    setPaths([]);
    setCurrentPath(null);
    console.log("[SignatureInputField] Cleared");
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!canvasRef.current || paths.length === 0) return;
    try {
      setSaving(true);

      // makeImageSnapshot is a method on the canvas ref in Skia 2.x —
      // it captures everything rendered: paths + timestamp text
      const snapshot = canvasRef.current.makeImageSnapshot();
      if (!snapshot) throw new Error("makeImageSnapshot returned null");

      // Encode to PNG bytes (Uint8Array)
      const bytes = snapshot.encodeToBytes();

      // Write to app document directory with a unique filename
      const filename = `signature_${Date.now()}.png`;
      const file = new File(Paths.document, filename);
      file.write(bytes);

      console.log("[SignatureInputField] Saved signature to:", file.uri);
      onChange(file.uri);
    } catch (err) {
      console.error("[SignatureInputField] Failed to save signature:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      {/* If a signature has been saved, show it as a preview */}
      {value ? (
        <View className="gap-2">
          <Image
            source={{ uri: value }}
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, borderRadius: 8 }}
            resizeMode="contain"
          />
          <Pressable
            className="py-2 rounded-xl items-center border border-border active:opacity-60"
            onPress={() => {
              onChange("");
              handleClear();
            }}
          >
            <Text className="text-text font-medium">Re-sign</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Drawing canvas — white background, black pen strokes */}
          <GestureDetector gesture={panGesture}>
            <Canvas
              ref={canvasRef}
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, borderRadius: 8, overflow: "hidden" }}
            >
              {/* White background */}
              <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} color="#ffffff" />

              {/* Completed strokes */}
              {paths.map((path, i) => (
                <Path
                  key={i}
                  path={path}
                  color={STROKE_COLOR}
                  style="stroke"
                  strokeWidth={STROKE_WIDTH}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ))}

              {/* In-progress stroke */}
              {currentPath && (
                <Path
                  path={currentPath}
                  color={STROKE_COLOR}
                  style="stroke"
                  strokeWidth={STROKE_WIDTH}
                  strokeCap="round"
                  strokeJoin="round"
                />
              )}

              {/* Timestamp baked into the bottom of the canvas.
                  Only rendered once the font is loaded — permanently embedded
                  in the saved PNG via makeImageSnapshot. */}
              {font && (
                <SkiaText
                  x={8}
                  y={CANVAS_HEIGHT - 8}
                  text={timestamp}
                  color="#888888"
                  font={font}
                />
              )}
            </Canvas>
          </GestureDetector>

          <Text className="text-textSecondary text-xs text-center italic">
            {isDrawing ? "Drawing..." : paths.length === 0 ? "Sign above" : "Tap Save or Clear"}
          </Text>

          {/* Action buttons */}
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 py-3 rounded-xl items-center border border-border active:opacity-60"
              onPress={handleClear}
            >
              <Text className="text-text font-medium">Clear</Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-3 rounded-xl items-center bg-primary ${
                saving || paths.length === 0 ? "opacity-50" : "active:opacity-80"
              }`}
              onPress={handleSave}
              disabled={saving || paths.length === 0}
            >
              <Text className="text-white font-bold">
                {saving ? "Saving..." : "Save Signature"}
              </Text>
            </Pressable>
          </View>
        </>
      )}

    </View>
  );
};
