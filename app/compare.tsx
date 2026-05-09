import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
    getDb,
    ReportFieldRow,
    ReportRow,
    sqliteHelper,
} from "@/utils/sqliteHelper";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Keyboard,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ReportFieldRow extended with the first image URI for camera fields.
// Non-camera fields have mediaUrl as null.
type FieldWithMedia = ReportFieldRow & { mediaUrl?: string | null };

// ─── Component ────────────────────────────────────────────────────────────────
//
// Lets the user enter a Property ID and side-by-side compare the two most
// recent reports filed against that property. Each field is shown as a pair
// of panes — one per report — so differences are immediately visible.
//
// Flow:
//   1. User types a Property ID and taps Search
//   2. SQL query finds up to 2 reports matching that ID for the current user
//   3. Fields for both reports are loaded in parallel and displayed in order

export default function CompareScreen() {
  const { user } = useAuth();

  // The Property ID the user typed into the search box.
  const [propertyId, setPropertyId] = useState("");
  // True while the initial report search query is running.
  const [searching, setSearching] = useState(false);
  // Feedback message shown below the search bar (errors, "no results", etc.).
  const [message, setMessage] = useState<string | null>(null);
  // The two reports being compared — always 0 or 2 entries once a search completes.
  const [reportsToCompare, setReportsToCompare] = useState<ReportRow[]>([]);
  // Fields for the older (A) and newer (B) reports respectively.
  const [fieldsA, setFieldsA] = useState<FieldWithMedia[]>([]);
  const [fieldsB, setFieldsB] = useState<FieldWithMedia[]>([]);
  // True while the field rows are being fetched after a successful search.
  const [loading, setLoading] = useState(false);

  // Clear all results whenever the user edits the Property ID so stale data
  // from a previous search is never shown alongside a new query.
  useEffect(() => {
    setMessage(null);
    setReportsToCompare([]);
    setFieldsA([]);
    setFieldsB([]);
  }, [propertyId]);

  // ── Search ────────────────────────────────────────────────────────────────

  // Finds the two most recent reports for the entered Property ID.
  // Uses a JOIN on Report_Field to match the "Property ID" field value —
  // Property ID is stored as a regular field rather than a top-level column.
  const handleSearchByPropertyId = async () => {
    if (!user) {
      setMessage("You must be logged in to search reports.");
      return;
    }
    if (!propertyId.trim()) {
      setMessage("Enter a Property ID to search.");
      return;
    }

    setSearching(true);
    setMessage(null);
    try {
      // Resolve Firebase UID → local SQLite userId
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) {
        setMessage("Local user not found.");
        setSearching(false);
        return;
      }

      const db = await getDb();

      // Fetch up to 2 reports for this property, newest first.
      // The JOIN ensures we only match reports that actually have a
      // "Property ID" field whose value equals the search input.
      const reports: ReportRow[] = await db.getAllAsync(
        `SELECT r.* FROM Report r
         JOIN Report_Field f ON f.reportId = r.reportId
         WHERE r.userId = ? AND f.fieldLabel = 'Property ID' AND f.fieldData = ?
         ORDER BY r.createdAt DESC
         LIMIT 2`,
        [localUser.userId, propertyId.trim()],
      );

      if (!reports || reports.length === 0) {
        setMessage("No reports found for that Property ID.");
        setReportsToCompare([]);
        setSearching(false);
        return;
      }

      // Need at least 2 reports to show a side-by-side comparison.
      if (reports.length === 1) {
        setMessage(
          "Only one report found for that Property ID — comparison unavailable.",
        );
        setReportsToCompare(reports);
        setSearching(false);
        return;
      }

      setReportsToCompare(reports);
      // Load fields for both reports in parallel before dismissing the keyboard.
      await loadFieldsForReports(reports[0].reportId!, reports[1].reportId!);
      Keyboard.dismiss();
    } catch (err: any) {
      console.error("[Compare] Search failed:", err);
      setMessage(err?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  // ── Load fields ───────────────────────────────────────────────────────────

  // Fetches all non-signature fields for both reports simultaneously.
  // Camera fields are joined with Report_Media to pull in the first image URI.
  // Both queries run in parallel via Promise.all for speed.
  const loadFieldsForReports = async (reportIdA: number, reportIdB: number) => {
    setLoading(true);
    try {
      const db = await getDb();

      // LEFT JOIN pulls in the first image for camera fields; non-camera fields
      // get null for mediaUrl. Signatures are excluded — they don't compare well
      // as text and aren't useful in a side-by-side view.
      const fieldsFor = (reportId: number) =>
        db.getAllAsync<FieldWithMedia>(
          `SELECT f.*, m.mediaUrl
           FROM Report_Field f
           LEFT JOIN Report_Media m ON m.fieldId = f.fieldId AND m.mediaType = 'image'
           WHERE f.reportId = ? AND f.fieldType != 'sign'
           ORDER BY f.fieldOrderNumber ASC`,
          [reportId],
        );

      const [a, b] = await Promise.all([
        fieldsFor(reportIdA),
        fieldsFor(reportIdB),
      ]);

      setFieldsA(a);
      setFieldsB(b);

      if (a.length === 0 && b.length === 0) {
        setMessage("No fields found in either report.");
      }
    } catch (err: any) {
      console.error("[Compare] Failed to load fields:", err);
      setMessage("Failed to load fields for comparison.");
    } finally {
      setLoading(false);
    }
  };

  // ── Label alignment ───────────────────────────────────────────────────────

  // Build a unified list of field labels from both reports so every label
  // appears exactly once in the comparison table. Using a Set deduplicates
  // labels that appear in both reports.
  // Sorted by fieldOrderNumber so the comparison rows follow the same order
  // as the original form — falling back to 9999 for labels only in one report.
  const allLabels = Array.from(
    new Set([
      ...fieldsA.map((f) => f.fieldLabel ?? "(untitled)"),
      ...fieldsB.map((f) => f.fieldLabel ?? "(untitled)"),
    ]),
  );
  allLabels.sort((l1, l2) => {
    const o1 =
      fieldsA.find((f) => f.fieldLabel === l1)?.fieldOrderNumber ??
      fieldsB.find((f) => f.fieldLabel === l1)?.fieldOrderNumber ??
      9999;
    const o2 =
      fieldsA.find((f) => f.fieldLabel === l2)?.fieldOrderNumber ??
      fieldsB.find((f) => f.fieldLabel === l2)?.fieldOrderNumber ??
      9999;
    return o1 - o2;
  });

  // Format the creation dates shown above each column header.
  const dateA = reportsToCompare[0]
    ? new Date(reportsToCompare[0].createdAt ?? "").toLocaleDateString()
    : "";
  const dateB = reportsToCompare[1]
    ? new Date(reportsToCompare[1].createdAt ?? "").toLocaleDateString()
    : "";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScreenHeader title="Compare by Property ID" />

      <ScrollView contentContainerClassName="px-5 py-6 gap-4" keyboardShouldPersistTaps="handled">

        {/* ── Search bar ────────────────────────────────────────────────── */}
        <Text className="text-sm text-textSecondary">Property ID</Text>
        <View className="flex-row gap-3">
          <TextInput
            className="flex-1 border border-border rounded-xl px-4 py-2 bg-surface text-text"
            placeholder="Enter Property ID"
            placeholderTextColor="#888"
            value={propertyId}
            onChangeText={setPropertyId}
          />
          <Pressable
            className="bg-primary px-4 py-2 rounded-xl items-center justify-center"
            onPress={handleSearchByPropertyId}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Search</Text>
            )}
          </Pressable>
        </View>

        {/* Feedback message — shown for errors, no results, or single-report warnings */}
        {message && <Text className="text-textSecondary mt-2">{message}</Text>}

        {/* ── Comparison table ──────────────────────────────────────────── */}
        {/* Only rendered when exactly 2 reports were found */}
        {reportsToCompare.length === 2 && (
          <View className="mt-4">
            <Text className="text-sm text-textSecondary mb-3">
              Comparing: {reportsToCompare[0].reportName}
            </Text>

            {loading ? (
              <ActivityIndicator />
            ) : (
              // One row per unique field label, showing A and B side by side.
              allLabels.map((label) => {
                const fieldA = fieldsA.find((f) => f.fieldLabel === label) ?? null;
                const fieldB = fieldsB.find((f) => f.fieldLabel === label) ?? null;
                // Use whichever report has this field to determine how to render it.
                const type = fieldA?.fieldType ?? fieldB?.fieldType ?? "text";

                return (
                  <View key={label} className="mb-5">
                    <Text className="text-sm font-medium text-text mb-2">
                      {label}
                    </Text>
                    <View className="flex-row gap-2">
                      {/* Left column — older report (A) */}
                      <View className="flex-1">
                        <Text className="text-xs text-textSecondary mb-1 text-center">
                          {dateA}
                        </Text>
                        <FieldPane field={fieldA} type={type} />
                      </View>
                      {/* Right column — newer report (B) */}
                      <View className="flex-1">
                        <Text className="text-xs text-textSecondary mb-1 text-center">
                          {dateB}
                        </Text>
                        <FieldPane field={fieldB} type={type} />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── FieldPane ────────────────────────────────────────────────────────────────
//
// Renders a single field value inside the comparison table.
// Handles three cases:
//   - null field   → "No data" placeholder (field didn't exist in this report)
//   - camera field → photo thumbnail, or "No image" if no media was saved
//   - text field   → plain text content, or "Empty" if the field was left blank

function FieldPane({
  field,
  type,
}: {
  field: FieldWithMedia | null;
  type: string;
}) {
  // Field didn't exist in this report at all — show a placeholder so the
  // row still aligns with the other column.
  if (!field) {
    return (
      <View className="bg-surface border border-border rounded-lg p-3 items-center justify-center min-h-[80px]">
        <Text className="text-textSecondary text-xs italic">No data</Text>
      </View>
    );
  }

  // Camera fields render as a square thumbnail using the joined mediaUrl.
  if (type === "camera") {
    return (
      <View
        className="bg-black rounded-lg overflow-hidden items-center justify-center"
        style={{ aspectRatio: 1 }}
      >
        {field.mediaUrl ? (
          <Image
            source={{ uri: field.mediaUrl }}
            style={{ width: "100%", height: "100%", resizeMode: "cover" }}
          />
        ) : (
          <Text className="text-white text-xs">No image</Text>
        )}
      </View>
    );
  }

  // All other field types (text, voice_text, etc.) render as plain text.
  const content = field.fieldData?.trim();
  return (
    <View className="bg-surface border border-border rounded-lg p-3 min-h-[80px]">
      {content ? (
        <Text className="text-text text-sm">{content}</Text>
      ) : (
        <Text className="text-textSecondary text-xs italic">Empty</Text>
      )}
    </View>
  );
}
