import * as Location from "expo-location";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GpsCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

// ─── getCurrentLocation ───────────────────────────────────────────────────────

// Requests foreground location permission and returns the device's current GPS
// coordinates. Returns null if permission is denied or the fix fails — callers
// should treat null as "no location available" rather than an error.

export const getCurrentLocation = async (): Promise<GpsCoords | null> => {
  try {
    console.log("[locationHelper] Requesting foreground location permission...");
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      console.log("[locationHelper] Permission denied — returning null");
      return null;
    }

    console.log("[locationHelper] Permission granted — getting GPS fix...");
    const location = await Location.getCurrentPositionAsync({
      // High accuracy uses GPS hardware (slower but precise).
      // Change to Balanced for faster fixes at the cost of some accuracy.
      accuracy: Location.Accuracy.High,
    });

    const coords: GpsCoords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };

    console.log("[locationHelper] GPS fix obtained:", coords);
    return coords;
  } catch (error) {
    // Non-fatal — GPS unavailable (indoors, airplane mode, etc.)
    console.warn("[locationHelper] Failed to get GPS fix (non-fatal):", error);
    return null;
  }
};

// ─── formatGpsString ──────────────────────────────────────────────────────────

// Formats coords as a "lat,lng" string for storage in the database.
// This is the format stored in Report_Media.mediaGPS.
// Example output: "-27.4705,153.0260"

export const formatGpsString = (coords: GpsCoords): string => {
  return `${coords.latitude},${coords.longitude}`;
};

// ─── getMapsUrl ───────────────────────────────────────────────────────────────

// Builds a Google Maps URL from coords.
// Can be used to open the location in the Maps app or render a map link.
// Example output: "https://www.google.com/maps?q=-27.4705,153.0260"

export const getMapsUrl = (coords: GpsCoords): string => {
  return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
};
