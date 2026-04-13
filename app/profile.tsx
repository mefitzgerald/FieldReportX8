import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { sqliteHelper, UserRow } from "@/utils/sqliteHelper";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localUser, setLocalUser] = useState<UserRow | null>(null);
  const [displayName, setDisplayName] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const row = await sqliteHelper.user.getByFirebaseUid(user.uid);
        setLocalUser(row);
        setDisplayName(row?.userDisplayName ?? "");
      } catch (error) {
        console.error("[ProfileScreen] Failed to load user:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!localUser?.userId) return;
    try {
      setSaving(true);
      await sqliteHelper.user.update(localUser.userId, {
        ...localUser,
        userDisplayName: displayName.trim() || null,
      });
      console.log("[ProfileScreen] Profile saved");
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error: any) {
      console.error("[ProfileScreen] Failed to save:", error);
      Alert.alert("Error", error?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScreenHeader title="Profile" />
        <ActivityIndicator className="mt-8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerClassName="px-5 py-6 gap-6">

        {/* Display Name */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">
            Display Name
          </Text>
          <TextInput
            className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
            placeholder="Your name"
            placeholderTextColor="#888"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        {/* Email — read only, comes from Firebase */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">
            Email
          </Text>
          <View className="border border-border rounded-xl px-4 py-4 bg-surface opacity-60">
            <Text className="text-base text-text">{user?.email ?? "—"}</Text>
          </View>
          <Text className="text-xs text-textSecondary">
            Email is managed by your login account and cannot be changed here.
          </Text>
        </View>

        {/* Save */}
        <Pressable
          className={`rounded-xl py-4 items-center bg-primary ${saving ? "opacity-60" : "active:opacity-80"}`}
          onPress={handleSave}
          disabled={saving}
        >
          <Text className="text-white font-bold text-base">
            {saving ? "Saving..." : "Save Profile"}
          </Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}
