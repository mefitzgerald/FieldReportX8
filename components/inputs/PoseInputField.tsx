import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import {
  getPoseAngles,
  POSE_CONNECTIONS,
  PoseDetection,
} from "@mefitzgerald/expo-pose-detection";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import ViewShot from "react-native-view-shot";

// ─── Types ────────────────────────────────────────────────────────────────────

// Tracks which UI screen the component is currently displaying.
// The component moves through these phases in order:
//   idle → camera → detecting → preview → (saving) → idle
// The user can also go back from camera or preview to idle via Cancel / Retake.
type Phase = "idle" | "camera" | "detecting" | "saving" | "preview";

interface PoseInputFieldProps {
  // Called with the permanent file URI of the confirmed composite image.
  // The parent form stores this URI as the field value.
  onChange: (uri: string) => void;
  // Current field value — a file URI if a pose has been confirmed, or "" if empty.
  // Used in the idle phase to show the previously confirmed composite image.
  value: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Full device width minus 16px padding on each side — matches the form's horizontal padding.
const SCREEN_WIDTH = Dimensions.get("window").width;
const PREVIEW_FRAME_WIDTH = SCREEN_WIDTH - 32;
// Fixed height for the preview container. Tall enough to show a full standing figure
// with some breathing room above and below.
const PREVIEW_FRAME_HEIGHT = 420;

// Maps ML Kit landmark indices to their corresponding angle getter from getPoseAngles.
// Each entry is [landmarkIndex, angleGetter] — the index identifies which joint dot
// to place the angle label near, and the getter extracts the pre-calculated angle
// (in degrees) from the pose angles result object.
// Only joints that have a meaningful single angle (e.g. elbow bend, knee flexion)
// are included — mid-body landmarks like wrists/feet are omitted.
const ANGLE_JOINTS: [
  number,
  (a: ReturnType<typeof getPoseAngles>) => number | undefined,
][] = [
  [11, (a) => a?.leftShoulder],
  [12, (a) => a?.rightShoulder],
  [13, (a) => a?.leftElbow],
  [14, (a) => a?.rightElbow],
  [23, (a) => a?.leftHip],
  [24, (a) => a?.rightHip],
  [25, (a) => a?.leftKnee],
  [26, (a) => a?.rightKnee],
  [27, (a) => a?.leftAnkle],
  [28, (a) => a?.rightAnkle],
];

// ─── Main component ───────────────────────────────────────────────────────────

// A form input that captures a pose photo, runs ML Kit pose detection on it,
// overlays a skeleton with joint angle labels, then saves the composite as a
// JPEG and passes its URI up to the parent form via onChange.
//
// Phase flow:
//   "idle"      — placeholder or confirmed composite image + "Capture Pose" / "Retake" button
//   "camera"    — live camera preview + "Detect" button
//   "detecting" — spinner while ML Kit processes the photo
//   "preview"   — captured photo with SVG skeleton + angle labels, "Retake" / "Confirm" buttons
//   "saving"    — spinner while ViewShot captures and copies the composite image

export const PoseInputField = ({ onChange, value }: PoseInputFieldProps) => {
  // expo-camera hook — returns the current permission status and a function to request it.
  // Will be null on the first render while the OS permission status is being checked.
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Ref to the CameraView so we can call takePictureAsync imperatively on detect.
  const cameraRef = useRef<CameraView>(null);

  // Which UI screen is currently active (see Phase type above).
  const [phase, setPhase] = useState<Phase>("idle");
  // True once the CameraView fires onCameraReady — prevents taking a photo before
  // the hardware is initialised, which would throw an error.
  const [cameraReady, setCameraReady] = useState(false);
  // URI of the raw photo taken by the camera, used as the background in the preview.
  const [photoUri, setPhotoUri] = useState<string>("");
  // Full list of PoseLandmark objects returned by ML Kit for the current photo.
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([]);
  // Pixel dimensions of the raw photo — needed to map landmark coordinates
  // (which are in image space) into the on-screen preview container.
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  // Ref to the ViewShot wrapper — used to call .capture() which renders the
  // photo + SVG overlay into a single flat JPEG stored in the temp directory.
  const viewShotRef = useRef<ViewShot>(null);

  // ── Permissions ───────────────────────────────────────────────────────────

  // Permission status is null while the OS is still resolving it — show a
  // spinner so the user sees something rather than a blank field.
  if (!cameraPermission) {
    return <ActivityIndicator />;
  }

  // Permission has been resolved but not yet granted — show an explanation
  // and a button to trigger the system permission dialog.
  if (!cameraPermission.granted) {
    return (
      <View className="items-center p-4 gap-3">
        <Text className="text-center text-textSecondary">
          Camera access is required to capture poses.
        </Text>
        <TouchableOpacity
          className="bg-primary py-3 rounded-xl w-full items-center"
          onPress={requestCameraPermission}
        >
          <Text className="text-white font-bold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Capture + detect ──────────────────────────────────────────────────────

  // Called when the user taps "Detect" in the camera phase.
  // Takes a still photo, sends it to ML Kit for pose detection, then moves
  // to the preview phase so the user can review the skeleton overlay.
  const handleDetect = async () => {
    if (!cameraRef.current || !cameraReady) return;

    try {
      console.log("[PoseInputField] Capturing photo for pose detection...");
      // Disable the button immediately to prevent double-taps while the
      // camera hardware is busy writing the image.
      setCameraReady(false);

      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) {
        setCameraReady(true);
        return;
      }

      // Ensure the URI has the file:// scheme — ML Kit requires a fully-qualified
      // local path and some devices omit the scheme from takePictureAsync results.
      const uri = photo.uri.startsWith("file://")
        ? photo.uri
        : `file://${photo.uri}`;
      const width = photo.width ?? 1;
      const height = photo.height ?? 1;

      // Switch to the detecting phase before the async ML Kit call so the
      // spinner appears immediately rather than after an invisible delay.
      setPhase("detecting");
      console.log("[PoseInputField] Running pose detection...");
      const results = await PoseDetection.detectPose(uri);
      console.log(`[PoseInputField] Detected ${results.length} landmarks`);

      // Store everything needed to render the preview, then switch phases.
      setPhotoUri(uri);
      setImageSize({ width, height });
      setLandmarks(results);
      setPhase("preview");
    } catch (e: any) {
      console.error("[PoseInputField] Detection failed:", e);
      Alert.alert("Detection failed", e?.message ?? "Unknown error");
      // Return to camera so the user can try again.
      setPhase("camera");
    } finally {
      // Always re-enable the button, whether detection succeeded or failed.
      setCameraReady(true);
    }
  };

  // ── Confirm — capture composite image and pass URI to parent ──────────────

  // Called when the user taps "Confirm" in the preview phase.
  // ViewShot renders the photo + SVG overlay into a temp JPEG, which is then
  // copied to the app's documents directory for a stable long-lived URI.
  // The permanent URI is passed to onChange so the parent form can store it.
  const handleConfirm = async () => {
    if (!viewShotRef.current) return;
    try {
      // ViewShot.capture() renders the current view tree to a temp file and
      // returns its URI. The cast to any is required because the library's
      // TypeScript types don't expose capture() on the ref directly.
      const tempUri = await (viewShotRef.current as any).capture();
      setPhase("saving");
      // Copy to documents directory so the URI remains valid after temp cleanup.
      // Using a timestamp in the filename ensures each capture gets a unique path.
      const dest = new File(Paths.document, `pose_${Date.now()}.jpg`);
      await new File(tempUri).copy(dest);
      console.log("[PoseInputField] Composite image saved:", dest.uri);
      // Notify the parent form with the permanent URI, then return to idle
      // so the confirmed image is displayed as the field's current value.
      onChange(dest.uri);
      setPhase("idle");
    } catch (e: any) {
      console.error("[PoseInputField] Save failed:", e);
      Alert.alert("Error", e?.message ?? "Could not save image.");
      // Stay on preview so the user can try confirming again.
      setPhase("preview");
    }
  };

  // ── Landmark scaling (image-pixel space → container screen space) ─────────
  //
  // ML Kit returns landmarks in visually-correct portrait space even if the
  // raw sensor image is landscape. Swap width/height if the raw image is
  // wider than it is tall to get the effective portrait dimensions.
  const isLandscape = imageSize.width > imageSize.height;
  const effectiveW = isLandscape ? imageSize.height : imageSize.width;
  const effectiveH = isLandscape ? imageSize.width : imageSize.height;

  const viewW = PREVIEW_FRAME_WIDTH;
  const viewH = PREVIEW_FRAME_HEIGHT;

  // Scale factor that keeps the full photo visible inside the preview.
  const containScale = Math.min(viewW / effectiveW, viewH / effectiveH);

  // Center the photo inside the preview when aspect ratios do not match.
  const offsetX = (viewW - effectiveW * containScale) / 2;
  const offsetY = (viewH - effectiveH * containScale) / 2;

  const scaleX = (x: number) => x * containScale + offsetX;
  const scaleY = (y: number) => y * containScale + offsetY;

  // Filter out landmarks the model is uncertain about — inFrameLikelihood < 0.5
  // means the joint is probably outside the camera frame or occluded.
  const visibleLandmarks = landmarks.filter((lm) => lm.inFrameLikelihood > 0.5);
  // Keyed by landmark type (integer index) for O(1) lookup when drawing bone lines,
  // since POSE_CONNECTIONS references landmarks by index pairs.
  const landmarkMap = new Map(visibleLandmarks.map((lm) => [lm.type, lm]));
  // Calculate all joint angles from the full landmark list (not just visible ones)
  // so the library has access to all three points needed for each angle calculation.
  const poseAngles = getPoseAngles(landmarks);
  // Build a map of landmarkIndex → angle (degrees) for the joints in ANGLE_JOINTS.
  // Entries where the angle couldn't be calculated (undefined) are excluded so
  // the SVG text rendering can safely skip them.
  const angleAtJoint = new Map<number, number>(
    ANGLE_JOINTS.flatMap(([idx, getter]) => {
      const val = getter(poseAngles);
      return val !== undefined ? [[idx, val]] : [];
    }),
  );

  // ── Phase: camera ─────────────────────────────────────────────────────────

  // Live camera viewfinder. The "Detect" button is dimmed and disabled until
  // onCameraReady fires, preventing a crash from calling takePictureAsync
  // before the hardware is ready. "Cancel" resets cameraReady and returns to idle.
  if (phase === "camera") {
    return (
      <View className="h-[400px] w-full rounded-2xl overflow-hidden">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          onCameraReady={() => setCameraReady(true)}
        />
        <View className="absolute bottom-5 w-full items-center gap-4">
          {/* Circular shutter-style button — opacity reflects camera readiness */}
          <TouchableOpacity
            className={`w-[70px] h-[70px] rounded-full bg-white border-4 border-gray-300 items-center justify-center ${!cameraReady ? "opacity-40" : ""}`}
            onPress={handleDetect}
            disabled={!cameraReady}
          >
            <Text className="text-xs font-bold text-gray-700">Detect</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              // Reset cameraReady so if the camera is reopened it waits for
              // onCameraReady again rather than using a stale true value.
              setCameraReady(false);
              setPhase("idle");
            }}
          >
            <Text className="text-white font-bold text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase: detecting ──────────────────────────────────────────────────────

  // Shown while ML Kit is processing the photo. The user cannot interact
  // with anything during this phase — they wait for detection to complete
  // before being taken to preview or back to camera on error.
  if (phase === "detecting") {
    return (
      <View className="h-[200px] justify-center items-center gap-3">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-textSecondary text-sm">Analysing pose…</Text>
      </View>
    );
  }

  // ── Phase: saving ────────────────────────────────────────────────────────

  // Shown while ViewShot is rendering the composite and copying it to disk.
  // Keeps the user informed during the brief async file operation.
  if (phase === "saving") {
    return (
      <View className="h-[200px] justify-center items-center gap-3">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-textSecondary text-sm">Saving image…</Text>
      </View>
    );
  }

  // ── Phase: preview ────────────────────────────────────────────────────────

  // Shows the captured photo with the SVG skeleton overlaid so the user can
  // review before confirming. The entire ViewShot subtree is what gets
  // flattened to a JPEG when the user taps "Confirm".
  if (phase === "preview") {
    return (
      <View className="w-full items-center gap-3">
        {/* ViewShot wraps the photo + SVG so .capture() can flatten them into one JPEG.
            Explicit pixel dimensions are required — ViewShot needs a fixed size to
            render correctly off-screen. */}
        <ViewShot
          ref={viewShotRef}
          style={{ width: PREVIEW_FRAME_WIDTH, height: PREVIEW_FRAME_HEIGHT }}
          options={{ format: "jpg", quality: 0.9 }}
        >
          <View
            style={{
              width: PREVIEW_FRAME_WIDTH,
              height: PREVIEW_FRAME_HEIGHT,
              backgroundColor: "#000", // black letterbox for photos that don't fill the frame
            }}
          >
            {/* The raw photo from the camera, scaled to fit inside the preview frame */}
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
            />

            {/* SVG skeleton overlay — drawn on top of the photo using absolute positioning.
                pointerEvents="none" lets touches pass through to buttons below the ViewShot. */}
            <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {/* Bone lines — one per entry in POSE_CONNECTIONS (e.g. shoulder→elbow).
                  Both endpoints must be visible (inFrameLikelihood > 0.5) or the line is skipped. */}
              {POSE_CONNECTIONS.map(([a, b], i) => {
                const lmA = landmarkMap.get(a);
                const lmB = landmarkMap.get(b);
                if (!lmA || !lmB) return null;
                return (
                  <Line
                    key={`line-${i}`}
                    x1={scaleX(lmA.x)}
                    y1={scaleY(lmA.y)}
                    x2={scaleX(lmB.x)}
                    y2={scaleY(lmB.y)}
                    stroke="#FF3D00"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Joint dots — cyan circle at each visible landmark position */}
              {visibleLandmarks.map((lm) => (
                <Circle
                  key={`dot-${lm.type}`}
                  cx={scaleX(lm.x)}
                  cy={scaleY(lm.y)}
                  r={5}
                  fill="#00E5FF"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              ))}

              {/* Angle labels — yellow text offset slightly above/right of each joint dot.
                  Only rendered for landmarks that have a calculated angle in angleAtJoint.
                  The thin black stroke improves legibility against both dark and light backgrounds. */}
              {visibleLandmarks.map((lm) => {
                const angle = angleAtJoint.get(lm.type);
                if (angle === undefined) return null;
                return (
                  <SvgText
                    key={`angle-${lm.type}`}
                    x={scaleX(lm.x) + 8}
                    y={scaleY(lm.y) - 8}
                    fontSize={11}
                    fontWeight="bold"
                    fill="#FFFF00"
                    stroke="#000000"
                    strokeWidth={0.5}
                  >
                    {Math.round(angle)}°
                  </SvgText>
                );
              })}
            </Svg>
          </View>
        </ViewShot>

        {/* Landmark count badge — only shown when at least one landmark was detected,
            gives the user a quick confidence indicator for detection quality */}
        {visibleLandmarks.length > 0 && (
          <View className="bg-black/60 px-2 py-1 rounded-full">
            <Text className="text-cyan-400 text-xs font-semibold">
              {visibleLandmarks.length} landmarks
            </Text>
          </View>
        )}

        <View className="flex-row gap-2 mt-2">
          <TouchableOpacity
            className="flex-1 border border-primary py-3 rounded-xl items-center"
            onPress={() => setPhase("camera")}
          >
            <Text className="text-primary font-bold">Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-primary py-3 rounded-xl items-center"
            onPress={handleConfirm}
          >
            <Text className="text-white font-bold">Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase: idle ───────────────────────────────────────────────────────────

  // Default state shown when the form first loads or after a pose is confirmed.
  // If a value (composite image URI) exists, it previews the confirmed image.
  // If empty, a placeholder is shown instead.
  // In both cases the button label adjusts to reflect whether this is a first
  // capture or a retake.
  return (
    <View className="items-center mb-2">
      {value ? (
        // Previously confirmed composite image — shows what will be saved with the report.
        <Image
          source={{ uri: value }}
          className="w-full h-[200px] rounded-xl mb-2"
          resizeMode="contain"
        />
      ) : (
        // Empty placeholder — shown before any pose has been captured.
        <View className="w-full h-[100px] bg-surface justify-center items-center rounded-xl mb-2">
          <Text className="text-textSecondary">No pose captured</Text>
        </View>
      )}

      <TouchableOpacity
        className="bg-primary py-3 rounded-xl w-full items-center"
        onPress={() => setPhase("camera")}
      >
        <Text className="text-white font-bold">
          {value ? "Retake Pose" : "Capture Pose"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
