import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { ReportTemplateRow, sqliteHelper } from "@/utils/sqliteHelper";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeleteTemplateScreen() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  // Refresh the list every time the screen comes into focus
  // so newly added templates are always reflected
  useFocusEffect(
    useCallback(() => {
      fetchTemplates();
    }, [user])
  );

  // Load all templates for the current user from SQLite
  const fetchTemplates = async () => {
    if (!user) {
      console.log("[DeleteTemplates] No user — skipping fetch");
      return;
    }
    try {
      setLoading(true);
      console.log("[DeleteTemplates] Fetching templates for user:", user.uid);

      // Resolve the local SQLite userId from the Firebase UID
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) {
        console.warn("[DeleteTemplates] Local user not found in SQLite");
        return;
      }

      // Fetch all templates for this user
      const results = await sqliteHelper.reportTemplate.getAllByUserId(
        localUser.userId
      );
      console.log("[DeleteTemplates] Fetched", results.length, "templates");
      setTemplates(results);
    } catch (error) {
      console.error("[DeleteTemplates] Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteTemplate = (template: ReportTemplateRow) => {
    if (!template.reportTemplateId) {
      console.warn("[DeleteTemplates] Delete called with no reportTemplateId");
      return;
    }

    // Block deletion of the built-in default template
    if (template.reportTemplateName === "Default Field Report") {
      Alert.alert(
        "Cannot Delete",
        "The Default Field Report template cannot be deleted.",
        [{ text: "OK" }]
      );
      return;
    }

    // Confirm before deleting — this also cascades to Report_Field_Templates
    // via the SQLite foreign key ON DELETE CASCADE
    Alert.alert(
      "Delete Template",
      `Delete "${template.reportTemplateName ?? "this template"}"? This will also remove all its fields.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () =>
            console.log("[DeleteTemplates] Delete cancelled:", template.reportTemplateId),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("[DeleteTemplates] Deleting template:", template.reportTemplateId);
              await sqliteHelper.reportTemplate.delete(template.reportTemplateId!);

              // Remove from local state immediately for instant UI feedback
              setTemplates((prev) =>
                prev.filter((t) => t.reportTemplateId !== template.reportTemplateId)
              );
              console.log("[DeleteTemplates] Template deleted successfully");
            } catch (error) {
              console.error("[DeleteTemplates] Failed to delete template:", error);
              Alert.alert("Error", "Failed to delete template.");
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>

      {/* Shared header with logo and back button */}
      <ScreenHeader title="Delete Templates" />

      {/* Instructional subtitle */}
      <Text className="text-textSecondary text-sm px-4 py-3">
        Tap a template to delete it and all its fields.
      </Text>

      {/* Loading state */}
      {loading && <ActivityIndicator className="mt-8" />}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <Text className="text-textSecondary italic m-4">
          No templates found.
        </Text>
      )}

      {/* Template list */}
      {!loading && templates.length > 0 && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.reportTemplateId?.toString() ?? ""}
          contentContainerClassName="px-4 pb-8"
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => (
            // Each row shows the template name and version.
            // Tapping triggers the delete confirmation alert.
            <Pressable
              className="flex-row items-center justify-between py-4 active:opacity-50"
              onPress={() => handleDeleteTemplate(item)}
            >
              {/* Template name — falls back to "Unnamed Template" if null */}
              <Text className="text-base text-text flex-1 mr-3">
                {item.reportTemplateName ?? "Unnamed Template"}
              </Text>

              {/* Version number */}
              <Text className="text-sm text-textSecondary">
                v{item.reportTemplateVersion ?? 1}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
