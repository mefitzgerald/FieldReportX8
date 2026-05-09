import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { sqliteHelper, BusinessProfileRow } from "@/utils/sqliteHelper";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { sanitizeText } from "@/utils/sanitize";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────
//
// Lets the logged-in user set up their business details (name, email, website,
// address, phone, logo). These are stored in SQLite and stamped onto generated
// PDF reports so clients see the correct company branding.
//
// The screen loads any existing profile on mount and upserts on save —
// creating a new row if none exists yet, updating the existing one otherwise.

export default function BusinessProfileScreen() {
  // Firebase user — used to look up the matching local SQLite userId on load.
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Local SQLite user ID — resolved from the Firebase UID on mount.
  const [userId, setUserId] = useState<number | null>(null);
  // The currently saved profile row — null if the user hasn't created one yet.
  // Kept in state so we know whether to INSERT or UPDATE on save.
  const [profile, setProfile] = useState<BusinessProfileRow | null>(null);

  // Individual form field states — each maps directly to a column in the DB.
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhoneNumber, setCompanyPhoneNumber] = useState("");
  // File URI of the logo stored in app document storage, or null if not set.
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  // Runs once when the Firebase user is available. Looks up the local user ID
  // then loads their business profile and pre-fills all form fields.
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Firebase UID is a string — resolve it to the local integer userId
        // that SQLite uses as the primary key across all tables.
        const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
        if (!localUser?.userId) {
          console.warn("[BusinessProfile] No local user found for Firebase UID:", user.uid);
          return;
        }
        setUserId(localUser.userId);

        // Load business profile for this user — returns null if not yet created.
        const row = await sqliteHelper.businessProfile.getByUserId(localUser.userId);
        console.log("[BusinessProfile] Loaded profile:", row);
        setProfile(row);

        // Pre-fill form fields — fall back to empty string / null for unset fields.
        setCompanyName(row?.companyName ?? "");
        setCompanyEmail(row?.companyEmail ?? "");
        setCompanyWebsite(row?.companyWebsite ?? "");
        setCompanyAddress(row?.companyAddress ?? "");
        setCompanyPhoneNumber(row?.companyPhoneNumber ?? "");
        setLogoUri(row?.companyLogo ?? null);
      } catch (error) {
        console.error("[BusinessProfile] Failed to load:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Logo picker ───────────────────────────────────────────────────────────

  // Opens the device photo library and lets the user pick a logo image.
  // The selected image is copied into the app's document directory so it
  // persists even if the user later deletes the original from their gallery.
  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow access to your photo library to upload a logo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const pickedUri = result.assets[0].uri;
      console.log("[BusinessProfile] Picked logo URI:", pickedUri);

      // Include userId and a timestamp in the filename so each user gets a
      // unique file and re-uploads don't collide with the previous version.
      const filename = `company_logo_${userId}_${Date.now()}.jpg`;
      const destFile = new File(Paths.document, filename);
      const srcFile = new File(pickedUri);
      await srcFile.copy(destFile);

      console.log("[BusinessProfile] Logo copied to:", destFile.uri);
      setLogoUri(destFile.uri);
    } catch (error) {
      console.error("[BusinessProfile] Failed to pick logo:", error);
      Alert.alert("Error", "Failed to load the selected image.");
    }
  };

  // Shows a confirmation alert before clearing the logo so the user doesn't
  // accidentally remove it with a mis-tap.
  const handleRemoveLogo = () => {
    Alert.alert("Remove Logo", "Remove the company logo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setLogoUri(null);
          console.log("[BusinessProfile] Logo removed");
        },
      },
    ]);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  // Upserts the business profile — updates the existing row if one exists
  // (identified by companyId), otherwise inserts a new one.
  // Empty strings are stored as null so optional fields don't clutter the DB.
  const handleSave = async () => {
    if (!userId) return;
    try {
      setSaving(true);

      const data: BusinessProfileRow = {
        userId,
        companyName: sanitizeText(companyName.trim()) || null,
        companyEmail: sanitizeText(companyEmail.trim()) || null,
        companyWebsite: sanitizeText(companyWebsite.trim()) || null,
        companyAddress: sanitizeText(companyAddress.trim()) || null,
        companyPhoneNumber: sanitizeText(companyPhoneNumber.trim()) || null,
        companyLogo: logoUri,
      };

      if (profile?.companyId) {
        // Profile already exists — update in place.
        await sqliteHelper.businessProfile.update(profile.companyId, data);
        console.log("[BusinessProfile] Profile updated, companyId:", profile.companyId);
      } else {
        // First save — insert and store the new companyId so subsequent saves update.
        const newId = await sqliteHelper.businessProfile.save(data);
        setProfile({ ...data, companyId: newId });
        console.log("[BusinessProfile] New profile created, companyId:", newId);
      }

      Alert.alert("Saved", "Your business profile has been updated.");
    } catch (error: any) {
      console.error("[BusinessProfile] Failed to save:", error);
      Alert.alert("Error", error?.message ?? "Failed to save business profile.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Show a spinner while the profile is being fetched from SQLite.
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScreenHeader title="Business Profile" />
        <ActivityIndicator className="mt-8" />
      </SafeAreaView>
    );
  }

  return (
    // KeyboardAvoidingView outside SafeAreaView so the padding calculation
    // accounts for the full screen height rather than the safe area inset.
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScreenHeader title="Business Profile" />
        <ScrollView contentContainerClassName="px-5 py-6 gap-6" keyboardShouldPersistTaps="handled">

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <View className="items-center gap-3">
            <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest self-start">
              Company Logo
            </Text>

            {/* Tappable logo preview — opens the picker directly for convenience */}
            <Pressable
              className="w-28 h-28 rounded-2xl border-2 border-dashed border-border bg-surface items-center justify-center overflow-hidden active:opacity-70"
              onPress={handlePickLogo}
            >
              {logoUri ? (
                <Image
                  source={{ uri: logoUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center gap-1">
                  <Text className="text-3xl text-textSecondary">🏢</Text>
                  <Text className="text-xs text-textSecondary text-center">Tap to add logo</Text>
                </View>
              )}
            </Pressable>

            {/* Change / Remove buttons — Remove only shown when a logo is set */}
            <View className="flex-row gap-3">
              <Pressable
                className="border border-border rounded-lg px-4 py-2 active:opacity-60"
                onPress={handlePickLogo}
              >
                <Text className="text-text text-sm font-medium">
                  {logoUri ? "Change Logo" : "Upload Logo"}
                </Text>
              </Pressable>
              {logoUri && (
                <Pressable
                  className="border border-danger rounded-lg px-4 py-2 active:opacity-60"
                  onPress={handleRemoveLogo}
                >
                  <Text className="text-danger text-sm font-medium">Remove</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Company Name ──────────────────────────────────────────────── */}
          <Field label="Company Name">
            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="Your company name"
              placeholderTextColor="#888"
              value={companyName}
              onChangeText={setCompanyName}
            />
          </Field>

          {/* ── Business Email ────────────────────────────────────────────── */}
          <Field label="Business Email">
            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="contact@company.com"
              placeholderTextColor="#888"
              value={companyEmail}
              onChangeText={setCompanyEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          {/* ── Website ───────────────────────────────────────────────────── */}
          <Field label="Website">
            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="https://www.company.com"
              placeholderTextColor="#888"
              value={companyWebsite}
              onChangeText={setCompanyWebsite}
              keyboardType="url"
              autoCapitalize="none"
            />
          </Field>

          {/* ── Address ───────────────────────────────────────────────────── */}
          <Field label="Address">
            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="123 Plenty Road, City, State"
              placeholderTextColor="#888"
              value={companyAddress}
              onChangeText={setCompanyAddress}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </Field>

          {/* ── Phone ─────────────────────────────────────────────────────── */}
          <Field label="Phone Number">
            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="+61 (03) 0000-0000"
              placeholderTextColor="#888"
              value={companyPhoneNumber}
              onChangeText={setCompanyPhoneNumber}
              keyboardType="phone-pad"
            />
          </Field>

          {/* ── Save ──────────────────────────────────────────────────────── */}
          <Pressable
            className={`rounded-xl py-4 items-center bg-primary ${saving ? "opacity-60" : "active:opacity-80"}`}
            onPress={handleSave}
            disabled={saving}
          >
            <Text className="text-white font-bold text-base">
              {saving ? "Saving..." : "Save Business Profile"}
            </Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

// Wraps a label + input in a consistent vertical layout.
// Keeps each form row self-contained so the parent doesn't need to repeat
// the label/gap pattern for every field.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">
        {label}
      </Text>
      {children}
    </View>
  );
}
