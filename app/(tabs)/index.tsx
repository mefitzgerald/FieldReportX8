import { useAuth } from "@/contexts/AuthContext";
import { ReportTemplateRow, sqliteHelper } from "@/utils/sqliteHelper";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  //vars
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  //ensure templates are fetched when the screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchTemplates();
    }, [user]),
  );

  // Function to fetch templates from the local SQLite database
  const fetchTemplates = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) return;
      const results = await sqliteHelper.reportTemplate.getAllByUserId(
        localUser.userId,
      );
      setTemplates(results);
    } catch (error) {
      console.error("[HomeScreen] Failed to fetch templates:", error);
    } finally {
      setLoading(false);
      console.log(
        "[HomeScreen] Finished fetching templates. Count:",
        templates.length,
      );
    }
  };

  // Handler for when a template is selected
  const handleSelectTemplate = (template: ReportTemplateRow) => {
    console.log("[HomeScreen] Navigating to report with template:", template);
    router.push({
      pathname: "/report",
      params: { templateId: template.reportTemplateId },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Text className="text-2xl font-bold text-text text-center my-4">
        Select a Template
      </Text>
      {/* Show loading indicator while fetching templates */}
      {loading && <ActivityIndicator className="mt-8"/>}
      {!loading && templates.length === 0 && (
        <Text className="text-textSecondary italic text-center m-4">No templates found.</Text>
      )}
      {/* Show the list of templates once loaded */}
      {!loading && templates.length > 0 && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.reportTemplateId?.toString() ?? ""}
          contentContainerClassName="px-4 pb-8"
          ItemSeparatorComponent={() => (
            <View className="h-px bg-border" />
          )}
          renderItem={({ item }) => (
            <Pressable
              className="flex-row items-center justify-between py-4 active:opacity-50"
              onPress={() => handleSelectTemplate(item)}
            >
              {/* Display the template name and version */}
              <Text className="text-base text-text flex-1 mr-3">
                {item.reportTemplateName ?? "Unnamed Template"}
              </Text>
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
