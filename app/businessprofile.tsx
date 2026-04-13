import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { sqliteHelper, BusinessProfileRow } from "@/utils/sqliteHelper";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system/next";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function BusinessProfileScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [profile, setProfile] = useState<BusinessProfileRow | null>(null);

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhoneNumber, setCompanyPhoneNumber] = useState("");
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Resolve local SQLite userId from Firebase UID
        const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
        if (!localUser?.userId) {
          console.warn("[BusinessProfile] No local user found for Firebase UID:", user.uid);
          return;
        }
        setUserId(localUser.userId);

        // Load business profile for this user
        const row = await sqliteHelper.businessProfile.getByUserId(localUser.userId);
        console.log("[BusinessProfile] Loaded profile:", row);
        setProfile(row);

        // Populate form fields from existing profile
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

  const handlePickLogo = async () => {
    try {
      // Request media library permission
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow access to your photo library to upload a logo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],   // square crop for logo
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const pickedUri = result.assets[0].uri;
      console.log("[BusinessProfile] Picked logo URI:", pickedUri);

      // Copy the picked image into app document storage so it persists
      // even if the user later deletes it from their gallery
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

  const handleSave = async () => {
    if (!userId) return;
    try {
      setSaving(true);

      const data: BusinessProfileRow = {
        userId,
        companyName: companyName.trim() || null,
        companyEmail: companyEmail.trim() || null,
        companyWebsite: companyWebsite.trim() || null,
        companyAddress: companyAddress.trim() || null,
        companyPhoneNumber: companyPhoneNumber.trim() || null,
        companyLogo: logoUri,
      };

      if (profile?.companyId) {
        // Update existing profile
        await sqliteHelper.businessProfile.update(profile.companyId, data);
        console.log("[BusinessProfile] Profile updated, companyId:", profile.companyId);
      } else {
        // Create new profile and store the returned id
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScreenHeader title="Business Profile" />
        <ActivityIndicator className="mt-8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScreenHeader title="Business Profile" />
      <ScrollView contentContainerClassName="px-5 py-6 gap-6">

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <View className="items-center gap-3">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest self-start">
            Company Logo
          </Text>

          {/* Logo preview or placeholder */}
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

          {/* Change / Remove buttons shown only when a logo is set */}
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
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

// Wraps a label + input in a consistent gap layout.
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
