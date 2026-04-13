import { getCurrentLocation, formatGpsString } from "@/utils/locationHelper";
import { useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_WIDTH = Dimensions.get("window").width - 48; // account for px-5 padding + gap
const MAP_HEIGHT = 220;

// How zoomed in the map appears — smaller delta = more zoomed in
const DEFAULT_DELTA = 0.005;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GpsMapInputFieldProps {
  onChange: (value: string) => void;
  value: string; // "latitude,longitude" string, or ""
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parses a stored "lat,lng" string back into numeric coords for the map.
// Returns null if the string is missing or malformed.
const parseCoords = (value: string): { latitude: number; longitude: number } | null => {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2) return null;
  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);
  if (isNaN(latitude) || isNaN(longitude)) return null;
  return { latitude, longitude };
};

// ─── Component ────────────────────────────────────────────────────────────────

// Captures GPS coordinates and renders them as a pinned marker on a map.
// The stored value is a "lat,lng" string — same format as GpsInputField and
// CameraInputField GPS tags, keeping location data consistent across the app.

export const GpsMapInputField = ({ onChange, value }: GpsMapInputFieldProps) => {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  const coords = parseCoords(value);

  // Build the MapView region from stored coords — centres the map on the marker
  const region: Region | undefined = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      }
    : undefined;

  const handleCapture = async () => {
    try {
      setCapturing(true);
      setError("");

      const location = await getCurrentLocation();
      if (!location) {
        setError("Could not get location. Check permissions and try again.");
        return;
      }

      const gpsString = formatGpsString(location);
      console.log("[GpsMapInputField] Captured GPS:", gpsString);
      onChange(gpsString);
    } catch (err) {
      console.error("[GpsMapInputField] Error capturing GPS:", err);
      setError("Failed to capture location.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View className="bg-surface border border-border rounded-xl p-4 gap-3">

      {/* Map — only shown once we have coordinates.
          MapView renders a native Google/Apple map tile with a Marker at the
          captured position. scrollEnabled and zoomEnabled are disabled so the
          map doesn't fight with the parent ScrollView for touch events. */}
      {coords && region ? (
        // pointerEvents="none" on the wrapper prevents the map from
        // intercepting touches and fighting with the parent ScrollView.
        // liteMode renders a static map snapshot on Android instead of
        // a fully interactive map — much more stable inside ScrollViews.
        <View style={{ width: MAP_WIDTH, height: MAP_HEIGHT }} pointerEvents="none">
          <MapView
            style={{ width: MAP_WIDTH, height: MAP_HEIGHT, borderRadius: 8 }}
            region={region}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            liteMode={true}
          >
            <Marker coordinate={coords} />
          </MapView>
        </View>
      ) : (
        // Explicit style dimensions required — native views like MapView need
        // pixel dimensions from style, not className, to measure correctly
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

      {/* Coordinates display */}
      {value ? (
        <Text className="text-text font-mono text-xs text-center">{value}</Text>
      ) : null}

      {/* Capture button */}
      <Pressable
        className={`py-3 rounded-xl items-center bg-primary ${capturing ? "opacity-60" : "active:opacity-80"}`}
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

      {/* Error message */}
      {!!error && <Text className="text-danger text-xs text-center">{error}</Text>}

    </View>
  );
};
