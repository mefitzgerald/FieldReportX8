import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, statusLabel } from "@/utils/formatters";
import { getDb, ReportRow, sqliteHelper } from "@/utils/sqliteHelper";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

// The set of values a user can filter reports by.
// "all" means no status filter is applied.
type StatusFilter = "all" | "draft" | "in_progress" | "completed" | "archived";

// ─── Constants ────────────────────────────────────────────────────────────────

// Displayed as pill buttons inside the collapsible filters panel.
// The "All" option clears the status filter so every report is shown.
const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All",         value: "all"         },
  { label: "Draft",       value: "draft"       },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed",   value: "completed"   },
  { label: "Archived",    value: "archived"    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  // Firebase user from auth context — needed to scope all SQLite queries
  const { user } = useAuth();

  // Full list of reports for the current user, fetched from SQLite on focus
  const [reports, setReports] = useState<ReportRow[]>([]);

  // Which status pill is currently selected — drives client-side filtering
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  // True while the initial report list is being fetched from SQLite
  const [loading, setLoading] = useState(true);

  // Controls whether the filters panel is expanded or collapsed
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The current value of the field search text input
  const [searchText, setSearchText] = useState("");

  // The SQLite integer userId for the logged-in user.
  // Stored in state so the search useEffect can use it without re-resolving
  // the Firebase UID on every keystroke.
  const [localUserId, setLocalUserId] = useState<number | null>(null);

  // The set of reportIds whose fields match the current searchText.
  // null means no search is active — all reports pass through.
  // An empty Set means a search ran but found no matches.
  const [matchingIds, setMatchingIds] = useState<Set<number> | null>(null);

  // ── Fetch reports ─────────────────────────────────────────────────────────

  // Re-fetch every time the screen comes into focus so that reports created
  // or edited on other screens always appear up-to-date here.
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [user])
  );

  // Resolves the Firebase UID to a local SQLite userId, then loads all reports
  // for that user ordered by creation date descending.
  const fetchReports = async () => {
    if (!user) {
      console.log("[HistoryScreen] No user — skipping fetch");
      return;
    }
    try {
      setLoading(true);
      console.log("[HistoryScreen] Fetching reports for user:", user.uid);

      // Firebase stores a UID string; SQLite uses an integer primary key.
      // This lookup bridges the two identity systems.
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) {
        console.warn("[HistoryScreen] Local user not found in SQLite");
        return;
      }

      // Store the integer userId so the search effect can use it directly
      // without re-resolving the Firebase UID on every keystroke.
      setLocalUserId(localUser.userId);

      const results = await sqliteHelper.report.getAllByUserId(localUser.userId);
      console.log("[HistoryScreen] Fetched", results.length, "reports");
      setReports(results);
    } catch (error) {
      console.error("[HistoryScreen] Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  // Pushes the report screen with the selected report's ID as a param,
  // which causes the report screen to load that report in edit mode.
  const handleOpenReport = (report: ReportRow) => {
    console.log("[HistoryScreen] Opening report:", report.reportId);
    router.push({
      pathname: "/report",
      params: { reportId: report.reportId },
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteReport = (report: ReportRow) => {
    if (!report.reportId) {
      console.warn("[HistoryScreen] Delete called with no reportId");
      return;
    }

    // Confirm before deleting — the SQLite delete cascades to Report_Field,
    // Report_Media, and Report_Sensor_Data via foreign key constraints,
    // so this action permanently removes all data for the report.
    Alert.alert(
      "Delete Report",
      `Delete "${report.reportName ?? "this report"}"? This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () =>
            console.log("[HistoryScreen] Delete cancelled:", report.reportId),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("[HistoryScreen] Deleting report:", report.reportId);
              await sqliteHelper.report.delete(report.reportId!);

              // Remove from local state immediately so the list updates
              // without waiting for a full refetch from SQLite.
              setReports((prev) =>
                prev.filter((r) => r.reportId !== report.reportId)
              );
              console.log("[HistoryScreen] Report deleted successfully");
            } catch (error) {
              console.error("[HistoryScreen] Failed to delete report:", error);
              Alert.alert("Error", "Failed to delete report.");
            }
          },
        },
      ]
    );
  };

  // ── Search ────────────────────────────────────────────────────────────────

  // Runs a debounced SQLite query whenever the search text changes.
  // Searches across all text and voice_text field values in Report_Field
  // for the current user. A 300ms delay prevents a query firing on every
  // individual keystroke.
  useEffect(() => {
    // If the search box is cleared, reset matchingIds to null so all reports
    // are shown again without any search filtering applied.
    if (!searchText.trim() || !localUserId) {
      setMatchingIds(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const db = await getDb();

        // Find all distinct reportIds where any text or voice_text field
        // contains the search term (case-insensitive via LIKE).
        // Only searches fields belonging to the current user's reports.
        const rows: { reportId: number }[] = await db.getAllAsync(
          `SELECT DISTINCT f.reportId
           FROM Report_Field f
           JOIN Report r ON r.reportId = f.reportId
           WHERE r.userId = ?
             AND (f.fieldType = 'text' OR f.fieldType = 'voice_text')
             AND f.fieldData LIKE ?`,
          [localUserId, `%${searchText.trim()}%`],
        );

        // Store results as a Set for O(1) lookup when filtering the report list
        setMatchingIds(new Set(rows.map((r) => r.reportId)));
      } catch (err) {
        console.error("[HistoryScreen] Search failed:", err);
      }
    }, 300);

    // Cancel the pending query if the user keeps typing before 300ms elapses
    return () => clearTimeout(timer);
  }, [searchText, localUserId]);

  // ── Filter ────────────────────────────────────────────────────────────────

  // Both filters are applied together in a single pass:
  // 1. Status filter — skipped when activeFilter is "all"
  // 2. Search filter — skipped when matchingIds is null (no active search)
  const filteredReports = reports
    .filter((r) => activeFilter === "all" || r.reportStatus === activeFilter)
    .filter((r) => matchingIds === null || matchingIds.has(r.reportId!));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background">

      <Text className="text-2xl font-bold text-text px-4 mt-4 mb-3">
        Report History
      </Text>

      {/* ── Filters toggle ───────────────────────────────────────────────── */}
      {/* Tapping this row expands or collapses the filters panel below */}
      <Pressable
        className="flex-row items-center justify-between px-4 py-3 border-y border-border bg-surface"
        onPress={() => setFiltersOpen((o) => !o)}
      >
        <Text className="text-sm font-semibold text-text">Filters</Text>
        <Text className="text-textSecondary text-xs">{filtersOpen ? "▲" : "▼"}</Text>
      </Pressable>

      {/* ── Filters panel ────────────────────────────────────────────────── */}
      {/* Only rendered when filtersOpen is true */}
      {filtersOpen && (
        <View className="bg-surface border-b border-border px-4 pt-3 pb-4 gap-4">

          {/* Search input — queries all text/voice_text fields in SQLite */}
          <View className="gap-2">
            <Text className="text-xs text-textSecondary font-medium uppercase tracking-wide">
              Search report fields
            </Text>
            {/* Fires a debounced SQLite query as the user types.
                clearButtonMode shows an iOS clear (×) button while typing. */}
            <TextInput
              className="border border-border rounded-xl px-4 py-2 bg-background text-text"
              placeholder="Type to search…"
              placeholderTextColor="#888"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Status filter pills — client-side, no DB query on each press */}
          <View className="gap-2">
            <Text className="text-xs text-textSecondary font-medium uppercase tracking-wide">
              Filter report by state
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  className={`border rounded-full py-1 px-3 ${
                    activeFilter === option.value
                      ? "bg-primary border-primary"
                      : "border-border"
                  }`}
                  onPress={() => setActiveFilter(option.value)}
                >
                  <Text
                    className={`text-sm ${
                      activeFilter === option.value
                        ? "text-white font-semibold"
                        : "text-text"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Clear filters — resets search text and status pill to defaults */}
          <View className="border-t border-border pt-3 gap-3">
            <Pressable
              className="border border-border rounded-xl py-2.5 items-center"
              onPress={() => {
                setSearchText("");
                setActiveFilter("all");
              }}
            >
              <Text className="text-text font-semibold text-sm">Clear Filters</Text>
            </Pressable>

            {/* Compare button — navigates to the compare screen.
                Kept separate from the filter pills so it reads as an action,
                not a filter option. */}
            <Pressable
              className="bg-primary rounded-xl py-2.5 items-center"
              onPress={() => router.push("/compare")}
            >
              <Text className="text-white font-semibold text-sm">
                Compare Reports by Property ID
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && <ActivityIndicator className="mt-8" />}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {/* Message varies depending on whether a search or status filter is active */}
      {!loading && filteredReports.length === 0 && (
        <Text className="text-textSecondary italic text-center m-4">
          {searchText.trim()
            ? `No reports match "${searchText.trim()}".`
            : activeFilter === "all"
            ? "No reports yet."
            : `No ${statusLabel(activeFilter).toLowerCase()} reports.`}
        </Text>
      )}

      {/* ── Report list ──────────────────────────────────────────────────── */}
      {!loading && filteredReports.length > 0 && (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.reportId?.toString() ?? ""}
          contentContainerClassName="pb-8"
          ItemSeparatorComponent={() => (
            <View className="h-px bg-border" />
          )}
          renderItem={({ item }) => (
            // Tapping the row opens the report in edit mode
            <Pressable
              className="flex-row items-center justify-between py-3.5 px-4 bg-surface active:opacity-50"
              onPress={() => handleOpenReport(item)}
            >
              {/* Left side — report name and creation date */}
              <View className="flex-1 mr-3">
                <Text className="text-base font-medium text-text" numberOfLines={1}>
                  {item.reportName ?? "Untitled Report"}
                </Text>
                <Text className="text-xs text-textSecondary mt-0.5">
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>

              {/* Right side — status label and delete button */}
              <View className="items-end gap-1.5">
                <Text className="text-sm text-textSecondary">
                  {statusLabel(item.reportStatus)}
                </Text>
                {/* Tapping delete shows a confirmation alert before removing */}
                <Pressable
                  className="bg-danger rounded-xl w-6 h-6 items-center justify-center"
                  onPress={() => handleDeleteReport(item)}
                >
                  <Text className="text-white font-bold text-xs">✕</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
