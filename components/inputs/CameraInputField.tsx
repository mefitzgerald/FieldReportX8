import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Canvas, Image as SkiaImage, Path, SkPath, Skia, useImage } from "@shopify/react-native-skia";
import { formatGpsString, getCurrentLocation } from "@/utils/locationHelper";
import { acquireCamera, releaseCamera } from "@/utils/cameraLock";

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PEN_COLOURS = [
  { label: "Black",  value: "#000000" },
  { label: "Red",    value: "#FF3B30" },
  { label: "Blue",   value: "#007AFF" },
  { label: "Green",  value: "#34C759" },
  { label: "Yellow", value: "#FFD60A" },
  { label: "White",  value: "#FFFFFF" }, // acts as eraser
];

const PEN_SIZES = [
  { label: "S", value: 3  },
  { label: "M", value: 7  },
  { label: "L", value: 14 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CameraInputFieldProps {
  onChange: (uri: string) => void;
  // Optional — called with "lat,lng" string after a photo is taken.
  // Parent stores this in Report_Media.mediaGPS.
  onGpsCapture?: (gps: string) => void;
  // Called with true when annotation phase starts, false when it ends.
  // Parent uses this to lock/unlock ScrollView scrolling while drawing.
  onAnnotatingChange?: (annotating: boolean) => void;
  value: string;
}

interface Stroke {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

// Phases:
//   "idle"       — preview (or placeholder) with Open Camera + optional Annotate button
//   "camera"     — live camera view
//   "saving"     — spinner while saving to media library + GPS lookup
//   "annotating" — Skia canvas overlaid on the captured photo

export const CameraInputField = ({
  onChange,
  onGpsCapture,
  onAnnotatingChange,
  value,
}: CameraInputFieldProps) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const [phase, setPhase] = useState<"idle" | "camera" | "annotating" | "saving">("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [penColor, setPenColor] = useState(PEN_COLOURS[0].value);
  const [penSize, setPenSize] = useState(PEN_SIZES[1].value); // default M

  const cameraRef = useRef<CameraView>(null);
  const annotationRef = useRef<{ confirm: () => void; clear: () => void } | null>(null);

  // Release the camera lock if the component unmounts while the camera is open
  // (e.g. the user presses the system back button).
  useEffect(() => {
    return () => releaseCamera();
  }, []);

  // Notify parent when annotation phase starts or ends so it can
  // lock/unlock ScrollView scrolling — prevents scroll intercepting draw gestures.
  useEffect(() => {
    onAnnotatingChange?.(phase === "annotating");
  }, [phase]);

  // ── Permissions ───────────────────────────────────────────────────────────

  if (!cameraPermission || !mediaPermission) {
    return <ActivityIndicator />;
  }

  if (!cameraPermission.granted || !mediaPermission.granted) {
    return (
      <View className="items-center p-4 gap-3">
        <Text className="text-center text-textSecondary">
          Camera and photo library access is required to capture photos.
        </Text>
        <TouchableOpacity
          className="bg-primary py-3 rounded-xl w-full items-center"
          onPress={async () => {
            await requestCameraPermission();
            await requestMediaPermission();
          }}
        >
          <Text className="text-white font-bold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Capture ───────────────────────────────────────────────────────────────

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      // Disable the capture button immediately to prevent double-taps.
      // Do NOT change phase yet — CameraView must stay mounted while
      // takePictureAsync runs. Switching phase unmounts it and causes a native error.
      setCameraReady(false);
      console.log("[CameraInputField] Capturing photo...");

      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) {
        setCameraReady(true);
        return;
      }

      // Photo is in hand — now safe to unmount CameraView and release the lock
      releaseCamera();
      setPhase("saving");

      // Save to device media library, then resolve a stable file:// URI.
      // asset.uri from createAssetAsync is a content:// URI on Android which can
      // fail to render in <Image> on dev builds — localUri is the reliable alternative.
      const asset = await MediaLibrary.createAssetAsync(photo.uri);
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
      const stableUri = assetInfo.localUri ?? asset.uri;
      console.log("[CameraInputField] Stable URI:", stableUri);

      // GPS is best-effort — if unavailable or denied, photo still saves normally
      const coords = await getCurrentLocation();
      if (coords) {
        console.log("[CameraInputField] GPS captured:", formatGpsString(coords));
        onGpsCapture?.(formatGpsString(coords));
      }

      onChange(stableUri);
      setPhase("idle");
    } catch (error) {
      console.error("[CameraInputField] Failed to take picture:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
      setCameraReady(true);
      setPhase("camera");
    }
  };

  // ── Annotation confirm ────────────────────────────────────────────────────

  const handleAnnotationConfirm = (uri: string) => {
    console.log("[CameraInputField] Annotated image saved:", uri);
    onChange(uri);
    setPhase("idle");
  };

  // ── Phase: camera ─────────────────────────────────────────────────────────

  if (phase === "camera") {
    return (
      <View className="h-[400px] w-full rounded-2xl overflow-hidden">
        {/* CameraView does not support children — controls sit in a sibling View
            with absolute positioning so they appear on top of the camera feed */}
        <CameraView
          style={{ flex: 1 }}
          ref={cameraRef}
          onCameraReady={() => setCameraReady(true)}
        />
        <View className="absolute bottom-5 w-full items-center gap-4">
          {/* Capture button — dimmed until camera hardware is ready */}
          <TouchableOpacity
            className={`w-[70px] h-[70px] rounded-full bg-white border-4 border-gray-300 ${!cameraReady ? "opacity-40" : ""}`}
            onPress={takePicture}
            disabled={!cameraReady}
          />
          <TouchableOpacity onPress={() => { releaseCamera(); setCameraReady(false); setPhase("idle"); }}>
            <Text className="text-white font-bold text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase: saving ─────────────────────────────────────────────────────────

  if (phase === "saving") {
    return (
      <View className="h-[200px] justify-center items-center gap-3">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-textSecondary text-sm">Processing…</Text>
      </View>
    );
  }

  // ── Phase: annotating ─────────────────────────────────────────────────────

  // Rendered inline (not in a Modal) so the parent's GestureHandlerRootView covers it.
  // Parent locks ScrollView scrolling via onAnnotatingChange so pan gestures
  // reach the Skia canvas instead of being intercepted by the scroll view.

  if (phase === "annotating") {
    return (
      <View className="w-full rounded-2xl overflow-hidden bg-black">

        {/* Top bar */}
        <View className="flex-row justify-between items-center px-4 py-3 bg-gray-900">
          <TouchableOpacity onPress={() => setPhase("idle")}>
            <Text className="text-white text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-white font-bold text-base">Annotate Photo</Text>
          <TouchableOpacity onPress={() => annotationRef.current?.confirm()}>
            <Text className="text-blue-400 font-bold text-base">Confirm ✓</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas container — measured so Skia gets exact pixel dimensions */}
        <View
          style={{ width: SCREEN_WIDTH }}
          onLayout={(e) => {
            const { width } = e.nativeEvent.layout;
            setCanvasSize({ width: Math.floor(width), height: Math.floor(width * 1.33) });
          }}
        >
          {value && canvasSize.width > 0 && (
            <AnnotationCanvasWithRef
              photoUri={value}
              canvasWidth={canvasSize.width}
              canvasHeight={canvasSize.height}
              penColor={penColor}
              penSize={penSize}
              onConfirm={handleAnnotationConfirm}
              ref={annotationRef}
            />
          )}
        </View>

        {/* Toolbar */}
        <View className="bg-gray-900 px-4 pt-3 pb-3 gap-3">

          {/* Colour swatches */}
          <View className="flex-row items-center gap-2">
            <Text className="text-gray-400 text-xs w-12">Colour</Text>
            {PEN_COLOURS.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setPenColor(c.value)}
                style={{ backgroundColor: c.value }}
                className={`w-8 h-8 rounded-full border-2 ${penColor === c.value ? "border-white" : "border-transparent"}`}
              />
            ))}
          </View>

          {/* Size presets + Clear */}
          <View className="flex-row items-center gap-2">
            <Text className="text-gray-400 text-xs w-12">Size</Text>
            {PEN_SIZES.map((s) => (
              <TouchableOpacity
                key={s.label}
                onPress={() => setPenSize(s.value)}
                className={`w-10 h-8 rounded-lg items-center justify-center border ${
                  penSize === s.value ? "bg-white border-white" : "border-gray-500"
                }`}
              >
                <Text className={penSize === s.value ? "text-black font-bold text-sm" : "text-white text-sm"}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View className="flex-1" />
            <TouchableOpacity
              className="px-4 h-8 rounded-lg border border-red-500 items-center justify-center"
              onPress={() => annotationRef.current?.clear()}
            >
              <Text className="text-red-400 text-sm font-bold">Clear</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    );
  }

  // ── Phase: idle ───────────────────────────────────────────────────────────

  return (
    <View className="items-center mb-2">
      {value ? (
        <Image source={{ uri: value }} className="w-full h-[200px] rounded-xl mb-2" />
      ) : (
        <View className="w-full h-[100px] bg-surface justify-center items-center rounded-xl mb-2">
          <Text className="text-textSecondary">No photo captured</Text>
        </View>
      )}

      <TouchableOpacity
        className="bg-primary py-3 rounded-xl w-full items-center mb-2"
        onPress={() => {
          if (!acquireCamera()) {
            Alert.alert("Camera in use", "Please close the other camera field first.");
            return;
          }
          setPhase("camera");
        }}
      >
        <Text className="text-white font-bold">
          {value ? "Retake Photo" : "Open Camera"}
        </Text>
      </TouchableOpacity>

      {/* Annotate button — only shown once a photo has been captured */}
      {value && (
        <TouchableOpacity
          className="border border-primary py-3 rounded-xl w-full items-center"
          onPress={() => setPhase("annotating")}
        >
          <Text className="text-primary font-bold">Annotate Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── AnnotationCanvasWithRef ──────────────────────────────────────────────────

// Skia canvas component that exposes confirm() and clear() to the parent via ref.
// confirm() takes a snapshot of the canvas (photo + strokes) and saves it to disk.
// clear() wipes all drawn strokes without affecting the background photo.

const AnnotationCanvasWithRef = forwardRef<
  { confirm: () => void; clear: () => void },
  {
    photoUri: string;
    canvasWidth: number;
    canvasHeight: number;
    penColor: string;
    penSize: number;
    onConfirm: (uri: string) => void;
  }
>(({ photoUri, canvasWidth, canvasHeight, penColor, penSize, onConfirm }, ref) => {
  const canvasRef = useRef<any>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPath, setCurrentPath] = useState<SkPath | null>(null);

  // Load the photo as a Skia image so it renders natively inside the Canvas
  const photo = useImage(photoUri);

  useImperativeHandle(ref, () => ({
    confirm: async () => {
      try {
        console.log("[AnnotationCanvas] Taking Skia snapshot...");
        // makeImageSnapshot captures the entire Canvas — photo + all strokes
        const snapshot = canvasRef.current?.makeImageSnapshot();
        if (!snapshot) {
          Alert.alert("Error", "Could not capture annotation. Please try again.");
          return;
        }
        // Encode to bytes and write to the app's persistent document directory
        const bytes = snapshot.encodeToBytes();
        const outFile = new File(Paths.document, `annotated_${Date.now()}.jpg`);
        outFile.write(bytes);
        console.log("[AnnotationCanvas] Saved:", outFile.uri);
        onConfirm(outFile.uri);
      } catch (error: any) {
        console.error("[AnnotationCanvas] Snapshot failed:", error);
        Alert.alert("Error", error?.message ?? "Failed to save annotation.");
      }
    },
    clear: () => {
      setStrokes([]);
      setCurrentPath(null);
      console.log("[AnnotationCanvas] Strokes cleared");
    },
  }));

  // Pan gesture tracks finger movement and builds Skia paths in real time.
  // runOnJS(true) is required so we can call setState from gesture callbacks.
  const drawGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      const path = Skia.Path.Make();
      path.moveTo(e.x, e.y);
      setCurrentPath(path);
    })
    .onUpdate((e) => {
      if (!currentPath) return;
      // Clone the path before mutating so React detects the state change
      const updated = currentPath.copy();
      updated.lineTo(e.x, e.y);
      setCurrentPath(updated);
    })
    .onEnd(() => {
      if (!currentPath) return;
      // Commit the finished stroke to the strokes array
      setStrokes((prev) => [
        ...prev,
        { path: currentPath, color: penColor, strokeWidth: penSize },
      ]);
      setCurrentPath(null);
    });

  return (
    <GestureDetector gesture={drawGesture}>
      <Canvas ref={canvasRef} style={{ width: canvasWidth, height: canvasHeight }}>

        {/* Photo rendered as Skia image — fit "contain" preserves aspect ratio */}
        {photo && (
          <SkiaImage
            image={photo}
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fit="contain"
          />
        )}

        {/* All committed strokes */}
        {strokes.map((stroke, i) => (
          <Path
            key={i}
            path={stroke.path}
            color={stroke.color}
            style="stroke"
            strokeWidth={stroke.strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        ))}

        {/* Stroke currently being drawn */}
        {currentPath && (
          <Path
            path={currentPath}
            color={penColor}
            style="stroke"
            strokeWidth={penSize}
            strokeCap="round"
            strokeJoin="round"
          />
        )}

      </Canvas>
    </GestureDetector>
  );
});
