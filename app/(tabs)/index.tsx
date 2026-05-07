import { useAuth } from "@/contexts/AuthContext";
import { ReportTemplateRow, sqliteHelper } from "@/utils/sqliteHelper";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
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

  // google mobile ads initialization
  useEffect(() => {
    mobileAds()
      .initialize()
      .catch((e) => console.warn("[mobileAds] init failed", e));
  }, []);

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
      {/* Native AdMob banner (test) */}
      <View
        style={{
          marginHorizontal: 0,
          paddingHorizontal: 0,
          marginBottom: 8,
          alignItems: "center",
          marginTop: -16,
        }}
      >
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.LARGE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(e) => console.warn("[AdMob] Banner failed", e)}
        />
      </View>

      {/* accessibilityRole="header" tells the screen reader this is a page
          heading — VoiceOver/TalkBack announces it with heading intonation
          and users can jump to headings by swiping with the rotor */}
      <Text
        className="text-2xl font-bold text-text text-center my-4"
        accessibilityRole="header"
      >
        Select a Template
      </Text>

      {/* accessibilityLabel gives the spinner a spoken label instead of silence.
          accessibilityRole="progressbar" tells the reader it's a loading state */}
      {loading && (
        <ActivityIndicator
          className="mt-8"
          accessibilityLabel="Loading templates"
          accessibilityRole="progressbar"
        />
      )}

      {/* Plain text — accessibilityLabel avoids the trailing period being
          read as a pause or full stop on some screen readers */}
      {!loading && templates.length === 0 && (
        <Text
          className="text-textSecondary italic text-center m-4"
          accessibilityLabel="No templates found"
        >
          No templates found.
        </Text>
      )}

      {/* accessible={false} on the FlatList prevents it being treated as a
          single focusable element — the screen reader steps through each
          Pressable item individually instead */}
      {!loading && templates.length > 0 && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.reportTemplateId?.toString() ?? ""}
          contentContainerClassName="px-4 pb-8"
          accessible={false}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => (
            // accessibilityRole="button" — announced as interactive
            // accessibilityLabel — reads template name and version as one phrase
            // accessibilityHint — tells the user what a tap will do
            <Pressable
              className="flex-row items-center justify-between py-4 active:opacity-50"
              onPress={() => handleSelectTemplate(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.reportTemplateName ?? "Unnamed Template"}, version ${item.reportTemplateVersion ?? 1}`}
              accessibilityHint="Double tap to start a new report"
            >
              {/* These Text nodes are grouped under the Pressable so the screen
                  reader reads them as part of the button label above, not
                  separately — no extra accessibility props needed here */}
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
