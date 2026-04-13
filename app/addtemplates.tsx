import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { jsonToDbHelper } from "@/utils/jsonToDbHelper";
import { sqliteHelper } from "@/utils/sqliteHelper";
import { getApp } from "firebase/app";
import { getDownloadURL, getStorage, listAll, ref } from "firebase/storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateFile {
  /** Display name — filename without the .json extension */
  name: string;
  /** Full path in Firebase Storage */
  fullPath: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Firebase Storage folder where JSON templates are stored
const TEMPLATES_FOLDER = "schemas";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddTemplatesScreen() {
  const { user } = useAuth();

  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch template list from Firebase Storage on mount
  useEffect(() => {
    fetchTemplateList();
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTemplateList = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[AddTemplates] Fetching template list from Firebase Storage");

      const storage = getStorage(getApp()); // Get default Firebase app's storage instance
      const folderRef = ref(storage, TEMPLATES_FOLDER); // Reference to the templates folder  
      const result = await listAll(folderRef); // List all items in the folder

      // Filter for .json files only and map to TemplateFile shape
      //  and maps the filename to a display name by removing the .json extension
      const files: TemplateFile[] = result.items
        .filter((item) => item.name.endsWith(".json"))
        .map((item) => ({
          name: item.name.replace(".json", ""),
          fullPath: item.fullPath,
        }));

      console.log("[AddTemplates] Fetched", files.length, "templates");
      setTemplates(files);
    } catch (err: any) {
      console.error("[AddTemplates] Failed to fetch templates:", err);
      setError(err?.message ?? "Failed to load templates from storage.");
    } finally {
      setLoading(false);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────

  // Show confirmation alert before downloading
  const handleTemplatePress = (template: TemplateFile) => {
    Alert.alert(
      "Download Template",
      `Add "${template.name}" to your templates?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Download", onPress: () => downloadTemplate(template) },
      ]
    );
  };

  // Download the JSON from Firebase Storage and insert into SQLite.
  // Duplicate check is handled inside insertJsonToDb.
  const downloadTemplate = async (template: TemplateFile) => {
    if (!user) {
      // Protected route means this shouldn't happen, but guard anyway cos expo be crazy
      Alert.alert("Error", "You must be logged in to download templates.");
      return;
    }

    try {
      setDownloading(template.fullPath);
      console.log("[AddTemplates] Downloading template:", template.name);

      // Resolve local SQLite userId from the Firebase UID
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) {
        throw new Error("Could not find your local user record.");
      }

      // Fetch the JSON file from Firebase Storage
      const storage = getStorage(getApp());
      const fileRef = ref(storage, template.fullPath);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const templateDoc = await response.json(); // This is the raw JSON object representing the template

      // Insert into SQLite
      const result = await jsonToDbHelper.insertJsonToDb(
        localUser.userId,
        templateDoc
      );

      if (result.processedTemplates === 0) {
        console.log("[AddTemplates] Template already exists:", template.name);
        Alert.alert(
          "Already Downloaded",
          `"${template.name}" is already in your templates.`
        );
      } else {
        console.log(
          "[AddTemplates] Template inserted:",
          template.name,
          "fields:",
          result.processedFields
        );
        Alert.alert(
          "Success",
          `"${template.name}" added with ${result.processedFields} fields.`
        );
      }
    } catch (err: any) {
      console.error("[AddTemplates] Download failed:", err);
      Alert.alert("Download Failed", err?.message ?? "Something went wrong.");
    } finally {
      setDownloading(null); // Clear downloading state regardless of success or failure
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>

      {/* Shared header with logo and screen title */}
      <ScreenHeader title="Add Templates" />

      {/* Refresh button */}
      <View className="flex-row justify-end px-4 py-2">
        <Pressable
          className="active:opacity-50"
          onPress={fetchTemplateList}
          disabled={loading}
        >
          <Text className="text-primary font-semibold text-sm">Refresh</Text>
        </Pressable>
      </View>

      {/* Loading state */}
      {loading && <ActivityIndicator className="mt-8" />}

      {/* Error state */}
      {!!error && (
        <Text className="text-danger m-4">{error}</Text>
      )}

      {/* Empty state */}
      {!loading && !error && templates.length === 0 && (
        <Text className="text-textSecondary italic m-4">
          No templates available.
        </Text>
      )}

      {/* Template list */}
      {!loading && templates.length > 0 && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.fullPath}
          contentContainerClassName="px-4 pb-8"
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => {
            const isDownloading = downloading === item.fullPath;
            return (
              <Pressable
                className={`flex-row justify-between items-center py-4 ${
                  isDownloading ? "opacity-40" : "active:opacity-50"
                }`}
                onPress={() => handleTemplatePress(item)}
                disabled={!!downloading}
              >
                {/* Template name */}
                <Text className="text-base text-text flex-1 mr-3">
                  {item.name}
                </Text>

                {/* Download indicator or label */}
                {isDownloading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-primary">
                    Download
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
