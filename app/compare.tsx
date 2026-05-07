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

type FieldWithMedia = ReportFieldRow & { mediaUrl?: string | null };

export default function CompareScreen() {
  const { user } = useAuth();

  const [propertyId, setPropertyId] = useState("");
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportsToCompare, setReportsToCompare] = useState<ReportRow[]>([]);
  const [fieldsA, setFieldsA] = useState<FieldWithMedia[]>([]);
  const [fieldsB, setFieldsB] = useState<FieldWithMedia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessage(null);
    setReportsToCompare([]);
    setFieldsA([]);
    setFieldsB([]);
  }, [propertyId]);

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
      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId) {
        setMessage("Local user not found.");
        setSearching(false);
        return;
      }

      const db = await getDb();

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

      if (reports.length === 1) {
        setMessage(
          "Only one report found for that Property ID — comparison unavailable.",
        );
        setReportsToCompare(reports);
        setSearching(false);
        return;
      }

      setReportsToCompare(reports);
      await loadFieldsForReports(reports[0].reportId!, reports[1].reportId!);
      Keyboard.dismiss();
    } catch (err: any) {
      console.error("[Compare] Search failed:", err);
      setMessage(err?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const loadFieldsForReports = async (reportIdA: number, reportIdB: number) => {
    setLoading(true);
    try {
      const db = await getDb();

      // LEFT JOIN pulls in the first image for camera fields; non-camera fields get null mediaUrl.
      // Signatures are excluded via fieldType != 'sign'.
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

  // Union of field labels from both reports, sorted by fieldOrderNumber
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

  const dateA = reportsToCompare[0]
    ? new Date(reportsToCompare[0].createdAt ?? "").toLocaleDateString()
    : "";
  const dateB = reportsToCompare[1]
    ? new Date(reportsToCompare[1].createdAt ?? "").toLocaleDateString()
    : "";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScreenHeader title="Compare by Property ID" />

      <ScrollView contentContainerClassName="px-5 py-6 gap-4" keyboardShouldPersistTaps="handled">
        {/* Property ID input + search button */}
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

        {message && <Text className="text-textSecondary mt-2">{message}</Text>}

        {reportsToCompare.length === 2 && (
          <View className="mt-4">
            <Text className="text-sm text-textSecondary mb-3">
              Comparing: {reportsToCompare[0].reportName}
            </Text>

            {loading ? (
              <ActivityIndicator />
            ) : (
              allLabels.map((label) => {
                const fieldA = fieldsA.find((f) => f.fieldLabel === label) ?? null;
                const fieldB = fieldsB.find((f) => f.fieldLabel === label) ?? null;
                const type = fieldA?.fieldType ?? fieldB?.fieldType ?? "text";

                return (
                  <View key={label} className="mb-5">
                    <Text className="text-sm font-medium text-text mb-2">
                      {label}
                    </Text>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="text-xs text-textSecondary mb-1 text-center">
                          {dateA}
                        </Text>
                        <FieldPane field={fieldA} type={type} />
                      </View>
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

function FieldPane({
  field,
  type,
}: {
  field: FieldWithMedia | null;
  type: string;
}) {
  if (!field) {
    return (
      <View className="bg-surface border border-border rounded-lg p-3 items-center justify-center min-h-[80px]">
        <Text className="text-textSecondary text-xs italic">No data</Text>
      </View>
    );
  }

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

  // text / voice_text
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
