import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, statusLabel } from "@/utils/formatters";
import { ReportRow, sqliteHelper } from "@/utils/sqliteHelper";
import { router, useFocusEffect } from "expo-router";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "draft" | "in_progress" | "completed" | "archived";

// ─── Constants ────────────────────────────────────────────────────────────────

// Filter options shown as pills at the top of the screen
const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All",         value: "all"         },
  { label: "Draft",       value: "draft"       },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed",   value: "completed"   },
  { label: "Archived",    value: "archived"    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { user } = useAuth();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  // ── Fetch reports ─────────────────────────────────────────────────────────

  // Refresh the list every time the screen comes into focus so edits
  // and newly created reports from other screens are always reflected
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [user])
  );

  // Load all reports for the current user from SQLite
  const fetchReports = async () => {
    if (!user) {
      console.log("[HistoryScreen] No user — skipping fetch");
      return;
    }
    try {
      setLoading(true);
      console.log("[HistoryScreen] Fetching reports for user:", user.uid);

      // Resolve the local SQLite userId from the Firebase UID
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) {
        console.warn("[HistoryScreen] Local user not found in SQLite");
        return;
      }

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

  // Open an existing report in edit mode by passing its reportId to the report screen.
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

    // Show confirmation alert before deleting — this action cascades to
    // Report_Field, Report_Media and Report_Sensor_Data via SQLite foreign keys
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

              // Remove from local state immediately for instant UI feedback
              // No need to refetch the entire list from SQLite
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

  // ── Filter ────────────────────────────────────────────────────────────────

  // Filter happens client-side on the already-fetched array — switching filters
  // is instant with no extra DB round trips
  const filteredReports =
    activeFilter === "all"
      ? reports
      : reports.filter((r) => r.reportStatus === activeFilter);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background">

      <Text className="text-2xl font-bold text-text text-center my-4">
        Report History
      </Text>

      {/* ── Status filter pills ──────────────────────────────────────────── */}
      {/* Filters client-side — no DB query on each press */}
      <View className="flex-row flex-wrap gap-2 px-4 mb-2">
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            className={`border rounded-full py-1.5 px-4 ${
              activeFilter === option.value
                ? "bg-primary border-primary"
                : "border-border"
            }`}
            onPress={() => {
              console.log("[HistoryScreen] Filter changed to:", option.value);
              setActiveFilter(option.value);
            }}
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

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && <ActivityIndicator className="mt-8" />}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && filteredReports.length === 0 && (
        <Text className="text-textSecondary italic text-center m-4">
          {activeFilter === "all"
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
          // Thin separator line between rows
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
                {/* Delete button — shows confirmation alert before deleting */}
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
