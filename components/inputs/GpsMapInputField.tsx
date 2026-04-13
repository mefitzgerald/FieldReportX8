import { getCurrentLocation, formatGpsString } from "@/utils/locationHelper";
import { File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Image, Pressable, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_WIDTH = Dimensions.get("window").width - 48; // account for px-5 padding + gap
const MAP_HEIGHT = 220;

// How zoomed in the map appears — smaller delta = more zoomed in
const DEFAULT_DELTA = 0.005;


// ─── Types ────────────────────────────────────────────────────────────────────

interface GpsMapInputFieldProps {
  onChange: (value: string) => void;
  value: string; // file:// URI of saved map snapshot image, or ""
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns true if the stored value is a saved image URI.
const isImageUri = (value: string): boolean =>
  value.startsWith("file://") || value.startsWith("content://");

// Parses a legacy "lat,lng" string into coords for backwards compatibility.
// Returns null if the string is missing, malformed, or already an image URI.
const parseCoords = (value: string): { latitude: number; longitude: number } | null => {
  if (!value || isImageUri(value)) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);
  if (isNaN(latitude) || isNaN(longitude)) return null;
  return { latitude, longitude };
};

// ─── Component ────────────────────────────────────────────────────────────────

// Captures GPS coordinates, renders a map tile with a marker, then automatically
// saves a PNG snapshot of the map once the map is ready. The stored value is a
// file:// URI so it embeds directly in PDF exports — consistent with camera and
// signature fields.
//
// The snapshot is triggered by onMapReady (with a short tile-load delay) so the
// user only needs to tap "Capture Location" — no second action required.
//
// The MapView is keyed on the coordinate string so re-capturing location forces
// a remount, which re-fires onMapReady and produces a fresh snapshot.
//
// liteMode is intentionally NOT used: lite mode blocks takeSnapshot() on Android.
// Touch conflicts with the parent ScrollView are prevented by pointerEvents="none".

export const GpsMapInputField = ({ onChange, value }: GpsMapInputFieldProps) => {
  const [capturing, setCapturing] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [error, setError] = useState("");

  // Internal GPS coords for rendering the map. Seeded from a legacy "lat,lng"
  // value on mount so existing reports still show the map in edit mode.
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(
    () => parseCoords(value)
  );

  // mapRef lets us call takeSnapshot() imperatively
  const mapRef = useRef<MapView>(null);

  // Guards against onRegionChangeComplete firing multiple times for the same
  // capture — reset to false whenever pendingCoords changes (new capture).
  const hasSnappedRef = useRef(false);

  useEffect(() => {
    hasSnappedRef.current = false;
  }, [pendingCoords]);

  // Re-seed pendingCoords if the value changes externally (e.g. form reset)
  useEffect(() => {
    if (!isImageUri(value)) {
      setPendingCoords(parseCoords(value));
    }
  }, [value]);

  // MapView region centred on the pending coordinates
  const region: Region | undefined = pendingCoords
    ? {
        latitude: pendingCoords.latitude,
        longitude: pendingCoords.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }
    : undefined;

  // Stable key for the MapView — changing it forces a remount so onMapReady
  // fires again when the user re-captures location.
  const mapKey = pendingCoords
    ? `${pendingCoords.latitude},${pendingCoords.longitude}`
    : "empty";

  // ── Capture GPS ───────────────────────────────────────────────────────────

  const handleCapture = async () => {
    try {
      setCapturing(true);
      setError("");

      const location = await getCurrentLocation();
      if (!location) {
        setError("Could not get location. Check permissions and try again.");
        return;
      }

      setPendingCoords({ latitude: location.latitude, longitude: location.longitude });
      console.log("[GpsMapInputField] Captured GPS:", formatGpsString(location));
    } catch (err) {
      console.error("[GpsMapInputField] Error capturing GPS:", err);
      setError("Failed to capture location.");
    } finally {
      setCapturing(false);
    }
  };

  // ── Save map snapshot ─────────────────────────────────────────────────────

  // Called automatically by onMapLoaded — fires once tiles are fully rendered,
  // which is the correct signal that the snapshot will not be blank.
  // Also callable via the retry button if a previous attempt failed.
  // Copies the snapshot out of the temp directory into documents for persistence.
  const handleSnapshot = async () => {
    if (!mapRef.current) return;
    try {
      setSnapping(true);
      setError("");

      const tempUri = await mapRef.current.takeSnapshot({
        format: "png",
        quality: 0.8,
        result: "file",
      });

      // Copy from the temp location to the document directory so the file
      // survives cache clears and persists with the saved report.
      const destFile = new File(Paths.document, `map_${Date.now()}.png`);
      new File(tempUri).copy(destFile);

      console.log("[GpsMapInputField] Saved map snapshot to:", destFile.uri);
      onChange(destFile.uri);
    } catch (err) {
      console.error("[GpsMapInputField] Snapshot failed:", err);
      setError("Map snapshot failed. Tap retry to try again.");
    } finally {
      setSnapping(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      {isImageUri(value) ? (
        // ── Saved state — show the snapshot image ──────────────────────────
        <View className="gap-3">
          <Image
            source={{ uri: value }}
            style={{ width: MAP_WIDTH, height: MAP_HEIGHT, borderRadius: 8 }}
            resizeMode="cover"
          />
          <Pressable
            className="py-3 rounded-xl items-center border border-border active:opacity-60"
            onPress={() => {
              onChange("");
              setPendingCoords(null);
            }}
          >
            <Text className="text-text font-medium">Re-capture Location</Text>
          </Pressable>
        </View>
      ) : (
        // ── Capture state ─────────────────────────────────────────────────
        <>
          {pendingCoords && region ? (
            // pointerEvents="none" prevents the map from intercepting touches
            // and fighting with the parent ScrollView.
            // The key forces a remount on re-capture so onMapLoaded fires
            // fresh for the new coordinates.
            <View style={{ width: MAP_WIDTH, height: MAP_HEIGHT }} pointerEvents="none">
              <MapView
                key={mapKey}
                ref={mapRef}
                style={{ width: MAP_WIDTH, height: MAP_HEIGHT, borderRadius: 8 }}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                onMapLoaded={() => {
                  // onMapLoaded fires after tiles are fully rendered — the correct
                  // signal for a snapshot. guarded by hasSnappedRef so it only
                  // fires once per capture even if the event triggers more than once.
                  if (hasSnappedRef.current) return;
                  hasSnappedRef.current = true;
                  handleSnapshot();
                }}
              >
                <Marker coordinate={pendingCoords} />
              </MapView>

              {/* Overlay spinner while snapshot is being taken */}
              {snapping && (
                <View
                  style={{
                    position: "absolute",
                    width: MAP_WIDTH,
                    height: MAP_HEIGHT,
                    borderRadius: 8,
                    backgroundColor: "rgba(0,0,0,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={{ color: "#fff", marginTop: 8, fontSize: 13 }}>Saving map…</Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={{
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#ccc",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="text-textSecondary text-sm italic">No location captured yet</Text>
            </View>
          )}

          {/* Capture button */}
          <Pressable
            className={`py-3 rounded-xl items-center bg-primary ${capturing || snapping ? "opacity-60" : "active:opacity-80"}`}
            onPress={handleCapture}
            disabled={capturing || snapping}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">
                {pendingCoords ? "Re-capture Location" : "Capture Location"}
              </Text>
            )}
          </Pressable>

          {/* Retry button — only shown if the auto-snapshot failed */}
          {!!error && pendingCoords && (
            <Pressable
              className="py-3 rounded-xl items-center border border-danger active:opacity-60"
              onPress={handleSnapshot}
            >
              <Text className="text-danger font-medium">Retry Snapshot</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Error message */}
      {!!error && <Text className="text-danger text-xs text-center">{error}</Text>}

    </View>
  );
};
