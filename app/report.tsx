import { CameraInputField } from "@/components/inputs/CameraInputField";
import { DateTimeInputField } from "@/components/inputs/DateTimeInputField";
import { GpsInputField } from "@/components/inputs/GpsInputField";
import { GpsMapInputField } from "@/components/inputs/GpsMapInputField";
import { RatingInputField } from "@/components/inputs/RatingInputField";
import { SensorInputField } from "@/components/inputs/SensorInputField";
import { SignatureInputField } from "@/components/inputs/SignatureInputField";
import { VoiceToTextInputField } from "@/components/inputs/VoiceToTextInputField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { previewReportPdf, shareReportPdf } from "@/utils/reportPdfGenerator";
import {
  ReportFieldRow,
  ReportFieldTemplateRow,
  ReportRow,
  ReportTemplateRow,
  sqliteHelper,
} from "@/utils/sqliteHelper";
import { useBatteryLevel } from "expo-battery";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportStatus = "draft" | "in_progress" | "completed" | "archived";
type FormValues = Record<string, string | object | null>;

// ─── Constants ────────────────────────────────────────────────────────────────

// Status options shown in the dropdown picker
const STATUS_OPTIONS: { label: string; value: ReportStatus }[] = [
  { label: "Draft", value: "draft" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

// ─── Checksum helper ──────────────────────────────────────────────────────────

// Generates a lightweight integrity fingerprint from the report data.
// Not cryptographic — used to detect if a report has been modified after submission.
const generateChecksum = (data: object): string => {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

// ─── Component ────────────────────────────────────────────────────────────────

// Handles both creating a new report (templateId param) and
// editing an existing report (reportId param).

export default function ReportScreen() {
  const { templateId, reportId } = useLocalSearchParams<{
    templateId?: string;
    reportId?: string;
  }>();
  const { user } = useAuth();

  // Battery level check on mount — shows alert if battery is critically low to warn about potential data loss.
  const batteryLevel = useBatteryLevel(); //live subscription so will update even if report is already open
  const batteryAlertShown = useRef(false); // will only alert once not every time data recieved

  useEffect(() => {
    if (
      !batteryAlertShown.current &&
      batteryLevel !== -1 &&
      batteryLevel < 0.15
    ) {
      batteryAlertShown.current = true;
      Alert.alert(
        "Low Battery",
        `Your battery is at ${Math.round(batteryLevel * 100)}%. Save your report now to avoid losing your work.`,
        [{ text: "OK" }],
      );
    }
  }, [batteryLevel]);

  // Determine if we are editing an existing report or creating a new one
  const isEditing = !!reportId;

  const [fields, setFields] = useState<ReportFieldTemplateRow[]>([]);
  const [template, setTemplate] = useState<ReportTemplateRow | null>(null);
  const [existingReport, setExistingReport] = useState<ReportRow | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>("draft");
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Disabled while a camera field is in annotation phase so the pan gesture
  // reaches Skia instead of being intercepted by the ScrollView.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  // Holds a ref to the camera field's View container so we can measure
  // its y offset and scroll to it precisely when annotation starts.
  const cameraFieldRef = useRef<View>(null);

  // Stores GPS coordinates keyed by form field key (e.g. "field_123").
  // Populated by CameraInputField's onGpsCapture callback when a photo is taken.
  // Used when saving to Report_Media.mediaGPS so each photo keeps its location tag.
  const [capturedGps, setCapturedGps] = useState<Record<string, string>>({});

  // Dynamic field names based on fieldTemplateId e.g. "field_123"
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  // ── Load data on mount ────────────────────────────────────────────────────

  useEffect(() => {
    if (isEditing) {
      loadExistingReport();
    } else {
      loadNewTemplate();
    }
  }, [templateId, reportId]);

  // New report — load the selected template and its field definitions
  const loadNewTemplate = async () => {
    if (!templateId) return;
    try {
      setLoading(true);
      console.log("[ReportScreen] Loading template:", templateId);
      const id = parseInt(templateId, 10);
      const loadedTemplate = await sqliteHelper.reportTemplate.getById(id);
      setTemplate(loadedTemplate ?? null);
      const templateFields =
        await sqliteHelper.reportFieldTemplate.getAllByTemplateId(id);
      setFields(templateFields);
      console.log("[ReportScreen] Loaded", templateFields.length, "fields");
    } catch (error) {
      console.error("[ReportScreen] Failed to load template:", error);
    } finally {
      setLoading(false);
    }
  };

  // Edit existing — load the saved report, map its fields, and pre-fill the form
  const loadExistingReport = async () => {
    if (!reportId) return;
    try {
      setLoading(true);
      console.log("[ReportScreen] Loading existing report:", reportId);
      const id = parseInt(reportId, 10);

      const report = await sqliteHelper.report.getById(id);
      if (!report) throw new Error("Report not found.");
      setExistingReport(report);

      // Pre-fill the status dropdown with the saved status
      if (report.reportStatus) {
        setReportStatus(report.reportStatus as ReportStatus);
      }

      const savedFields = await sqliteHelper.reportField.getAllByReportId(id);

      // Map Report_Field rows to ReportFieldTemplateRow shape so renderField
      // works identically for both new and existing reports
      const mappedFields: ReportFieldTemplateRow[] = savedFields.map(
        (f: ReportFieldRow) => ({
          fieldTemplateId: f.fieldId,
          reportTemplateId: 0,
          fieldTemplateLabel: f.fieldLabel,
          fieldTemplateType: f.fieldType,
          fieldTemplateRequired: f.fieldRequired,
          fieldOrderNumber: f.fieldOrderNumber,
        }),
      );
      setFields(mappedFields);

      // Pre-fill form values from saved fieldData.
      // Try JSON parse first (sensor data), fall back to raw string (text/camera).
      const defaultValues: FormValues = {};
      for (const f of savedFields) {
        const fieldKey = `field_${f.fieldId}`;
        if (f.fieldData) {
          try {
            defaultValues[fieldKey] = JSON.parse(f.fieldData);
          } catch {
            defaultValues[fieldKey] = f.fieldData;
          }
        }
      }
      reset(defaultValues);
      console.log(
        "[ReportScreen] Loaded",
        savedFields.length,
        "existing fields",
      );
    } catch (error) {
      console.error("[ReportScreen] Failed to load existing report:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (formData: FormValues) => {
    if (!user) return;

    try {
      setSubmitting(true);
      console.log("[ReportScreen] Submitting report, isEditing:", isEditing);

      const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
      if (!localUser?.userId)
        throw new Error("Could not find local user record.");

      const timestamp = new Date().toISOString();
      const checksum = generateChecksum({
        templateId: templateId ?? reportId,
        userId: localUser.userId,
        timestamp,
        status: reportStatus,
        formData,
      });

      if (isEditing && existingReport?.reportId) {
        // ── Edit mode — update the existing report and its fields ───────────
        await sqliteHelper.report.update(existingReport.reportId, {
          ...existingReport,
          reportStatus,
          reportChecksum: checksum,
        });

        for (const field of fields) {
          const fieldKey = `field_${field.fieldTemplateId}`;
          const rawValue = formData[fieldKey];
          const fieldData =
            rawValue != null
              ? typeof rawValue === "object"
                ? JSON.stringify(rawValue)
                : String(rawValue)
              : null;

          if (field.fieldTemplateId) {
            await sqliteHelper.reportField.update(field.fieldTemplateId, {
              reportId: existingReport.reportId,
              fieldLabel: field.fieldTemplateLabel,
              fieldType: field.fieldTemplateType,
              fieldRequired: field.fieldTemplateRequired,
              fieldOrderNumber: field.fieldOrderNumber,
              fieldData,
            });
          }
        }
        console.log("[ReportScreen] Report updated:", existingReport.reportId);
      } else {
        // ── New report — insert report row then all field rows ───────────────
        if (!template) return;

        const newReportId = await sqliteHelper.report.save({
          userId: localUser.userId,
          reportName: template.reportTemplateName,
          reportCategory: template.reportTemplateCategory,
          reportLayout: template.reportTemplateLayout,
          reportLayoutLogo: template.reportTemplateLayoutLogo ?? 0,
          reportLayoutCompanyName:
            template.reportTemplateLayoutCompanyName ?? 0,
          reportLayoutContactDetails:
            template.reportTemplateLayoutContactDetails ?? 0,
          reportFieldCount: fields.length,
          reportStatus,
          reportChecksum: checksum,
          reportCreatedWithAppVersion: Constants.expoConfig?.version ?? null,
        });

        // Insert each field, linking to the new reportId. For camera and sensor fields,
        // also insert into the relevant media/sensor tables for richer querying and export.
        for (const field of fields) {
          const fieldKey = `field_${field.fieldTemplateId}`;
          const rawValue = formData[fieldKey];
          const fieldData =
            rawValue != null
              ? typeof rawValue === "object"
                ? JSON.stringify(rawValue)
                : String(rawValue)
              : null;

          const savedFieldId = await sqliteHelper.reportField.save({
            reportId: newReportId,
            fieldLabel: field.fieldTemplateLabel,
            fieldType: field.fieldTemplateType,
            fieldRequired: field.fieldTemplateRequired,
            fieldOrderNumber: field.fieldOrderNumber,
            fieldData,
          });

          // Image fields — also save to Report_Media for gallery/export use.
          // camera: annotated photo with GPS tag from onGpsCapture.
          // sign: signature PNG — no GPS needed.
          // gps_map: map snapshot PNG — GPS coords are baked into the image visually.
          if (
            (field.fieldTemplateType === "camera" ||
              field.fieldTemplateType === "sign" ||
              field.fieldTemplateType === "gps_map") &&
            typeof rawValue === "string" &&
            rawValue
          ) {
            const gps =
              field.fieldTemplateType === "camera"
                ? (capturedGps[fieldKey] ?? null)
                : null;
            console.log(
              "[ReportScreen] Saving",
              field.fieldTemplateType,
              "field to Report_Media",
            );
            await sqliteHelper.reportMedia.save({
              fieldId: savedFieldId,
              mediaType: "image",
              mediaUrl: rawValue,
              mediaGPS: gps,
              mediaTimestamp: timestamp,
            });
          }

          // Sensor fields — also save to Report_Sensor_Data for richer querying
          if (
            field.fieldTemplateType === "sensor_gyro" &&
            typeof rawValue === "object" &&
            rawValue !== null
          ) {
            await sqliteHelper.reportSensorData.save({
              fieldId: savedFieldId,
              sensorDataType: "gyroscope",
              sensorDataResults: JSON.stringify(rawValue),
              sensorDataTimestamp: timestamp,
            });
          }
        }
        console.log("[ReportScreen] New report saved with ID:", newReportId);
      }

      Alert.alert(
        isEditing ? "Report Updated" : "Report Saved",
        isEditing
          ? "Your report has been updated."
          : "Your report has been saved.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error: any) {
      console.error("[ReportScreen] Failed to save report:", error);
      Alert.alert("Error", error?.message ?? "Failed to save report.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────

  // Shows an alert letting the user choose between previewing and sharing.
  // Preview opens the native print dialog.
  // Share opens the native share sheet (email, Google Drive, WhatsApp etc.)
  const handleExportPdf = async () => {
    if (!existingReport) {
      Alert.alert("Save First", "Please save the report before exporting.");
      return;
    }

    try {
      setExporting(true);
      console.log(
        "[ReportScreen] Preparing PDF for report:",
        existingReport.reportId,
      );

      const savedFields = await sqliteHelper.reportField.getAllByReportId(
        existingReport.reportId!,
      );

      // Load business profile only if the report layout requires it
      let businessProfile = null;
      if (
        existingReport.reportLayoutLogo === 1 ||
        existingReport.reportLayoutCompanyName === 1 ||
        existingReport.reportLayoutContactDetails === 1
      ) {
        const localUser = await sqliteHelper.user.getByFirebaseUid(user!.uid);
        if (localUser?.userId) {
          businessProfile = await sqliteHelper.businessProfile.getByUserId(
            localUser.userId,
          );
        }
      }

      const pdfData = {
        report: existingReport,
        fields: savedFields,
        businessProfile,
        userDisplayName: user?.displayName ?? null,
      };

      // Let the user choose between preview and share
      Alert.alert(
        "Export Report",
        "How would you like to export this report?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Preview",
            onPress: async () => {
              console.log("[ReportScreen] Opening PDF preview");
              await previewReportPdf(pdfData);
            },
          },
          {
            text: "Share",
            onPress: async () => {
              console.log("[ReportScreen] Opening share sheet");
              await shareReportPdf(pdfData);
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("[ReportScreen] PDF export failed:", error);
      Alert.alert("Export Failed", error?.message ?? "Failed to generate PDF.");
    } finally {
      setExporting(false);
    }
  };

  // ── Render field ──────────────────────────────────────────────────────────

  // Renders the appropriate input component based on the field type.
  // Field key is "field_{fieldTemplateId}" — unique per field in the form.
  const renderField = (field: ReportFieldTemplateRow) => {
    const fieldKey = `field_${field.fieldTemplateId}`;
    const isRequired = field.fieldTemplateRequired === 1;

    return (
      <View
        key={fieldKey}
        // Camera fields get a ref so we can measure y offset for annotation scroll
        ref={field.fieldTemplateType === "camera" ? cameraFieldRef : undefined}
        className="mb-6"
      >
        {/* Field label — uppercase with red asterisk for required fields */}
        <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest mb-2">
          {field.fieldTemplateLabel}
          {isRequired && <Text className="text-danger"> *</Text>}
        </Text>

        <Controller
          control={control}
          name={fieldKey}
          rules={
            isRequired
              ? { required: `${field.fieldTemplateLabel} is required` }
              : {}
          }
          render={({ field: { onChange, value } }) => {
            switch (field.fieldTemplateType) {
              case "camera":
                return (
                  <CameraInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                    // When a photo is taken, store the GPS string against this field key
                    // so we can write it to Report_Media.mediaGPS on submit.
                    onGpsCapture={(gps) => {
                      console.log(
                        "[ReportScreen] GPS received for",
                        fieldKey,
                        ":",
                        gps,
                      );
                      setCapturedGps((prev) => ({ ...prev, [fieldKey]: gps }));
                    }}
                    onAnnotatingChange={(annotating) => {
                      setScrollEnabled(!annotating);
                      if (annotating) {
                        if (cameraFieldRef.current && scrollRef.current) {
                          // Measure the camera field's y offset within the ScrollView
                          // then scroll to it so the full annotation UI is visible
                          const node = findNodeHandle(scrollRef.current);
                          if (!node) return;
                          cameraFieldRef.current.measureLayout(
                            node,
                            (_x: number, y: number) => {
                              scrollRef.current?.scrollTo({
                                y,
                                animated: true,
                              });
                            },
                            () => {},
                          );
                        }
                      }
                    }}
                  />
                );
              case "sensor_gyro":
                return (
                  <SensorInputField
                    onChange={onChange}
                    value={(value as any) ?? null}
                    type="gyroscope"
                  />
                );
              case "text":
                return (
                  <TextInput
                    className={`border rounded-xl px-4 py-4 text-base text-text bg-surface ${
                      errors[fieldKey] ? "border-danger" : "border-border"
                    }`}
                    placeholder={field.fieldTemplateLabel ?? ""}
                    placeholderTextColor="#888"
                    onChangeText={onChange}
                    value={(value as string) ?? ""}
                  />
                );
              case "voice":
              case "voice_text":
              case "speech":
              case "speech_to_text":
                return (
                  <VoiceToTextInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                    placeholder={field.fieldTemplateLabel ?? ""}
                  />
                );
              // GPS coordinates only — capture button + lat,lng display
              case "sensor_gps":
                return (
                  <GpsInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                  />
                );
              // GPS coordinates + map tile with marker
              case "gps_map":
                return (
                  <GpsMapInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                  />
                );
              // Date picker — stores human-readable date string
              case "date":
                return (
                  <DateTimeInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                    mode="date"
                  />
                );
              // Time picker — stores human-readable time string
              case "time":
                return (
                  <DateTimeInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                    mode="time"
                  />
                );
              // 1–5 radio rating
              case "rating_5":
                return (
                  <RatingInputField
                    onChange={onChange}
                    value={(value as unknown as number) ?? null}
                  />
                );
              // Freehand signature pad — saves as image file, stores URI
              case "sign":
                return (
                  <SignatureInputField
                    onChange={onChange}
                    value={(value as string) ?? ""}
                  />
                );
              default:
                return (
                  <TextInput
                    className={`border rounded-xl px-4 py-4 text-base text-text bg-surface ${
                      errors[fieldKey] ? "border-danger" : "border-border"
                    }`}
                    placeholder={field.fieldTemplateLabel ?? ""}
                    placeholderTextColor="#888"
                    onChangeText={onChange}
                    value={(value as string) ?? ""}
                  />
                );
            }
          }}
        />

        {/* Validation error message */}
        {errors[fieldKey] && (
          <Text className="text-danger text-xs mt-1">
            {(errors[fieldKey]?.message as string) ?? "Required"}
          </Text>
        )}
      </View>
    );
  };

  // ── Loading / empty states ────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScreenHeader title={isEditing ? "Edit Report" : "New Report"} />
        <ActivityIndicator className="mt-8" />
      </SafeAreaView>
    );
  }

  if (fields.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
        <ScreenHeader title="Report" />
        <Text className="text-textSecondary italic text-center m-4">
          No fields found for this template.
        </Text>
      </SafeAreaView>
    );
  }

  const selectedStatusLabel =
    STATUS_OPTIONS.find((s) => s.value === reportStatus)?.label ?? "Draft";
  const screenTitle = isEditing
    ? (existingReport?.reportName ?? "Edit Report")
    : (template?.reportTemplateName ?? "New Report");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {/* Shared header with logo, title and back button */}
      <ScreenHeader title={screenTitle} />

      <ScrollView
        ref={scrollRef}
        contentContainerClassName="px-5 py-4 pb-16"
        scrollEnabled={scrollEnabled}
      >
        {/* Editing badge — shown when updating an existing report */}
        {isEditing && (
          <Text className="text-primary text-xs font-semibold mb-4">
            Editing
          </Text>
        )}

        {/* ── Status picker ─────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-textSecondary">
            Status
          </Text>
          <Pressable
            className="border border-border rounded-lg py-2 px-4 active:opacity-50"
            onPress={() => setShowStatusPicker((prev) => !prev)}
          >
            <Text className="text-sm font-medium text-text">
              {selectedStatusLabel} ▾
            </Text>
          </Pressable>
        </View>

        {/* Status dropdown options */}
        {showStatusPicker && (
          <View className="border border-border rounded-lg mb-5 overflow-hidden">
            {STATUS_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                className={`py-3 px-4 active:opacity-50 ${
                  reportStatus === option.value ? "bg-surface" : ""
                }`}
                onPress={() => {
                  setReportStatus(option.value);
                  setShowStatusPicker(false);
                }}
              >
                <Text
                  className={`text-base text-text ${
                    reportStatus === option.value ? "font-bold" : ""
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Dynamic form fields ───────────────────────────────────────── */}
        {fields.map((field) => renderField(field))}

        {/* ── Submit button ─────────────────────────────────────────────── */}
        <Pressable
          className={`rounded-xl py-4 items-center mt-2 bg-primary ${
            submitting || exporting ? "opacity-60" : "active:opacity-80"
          }`}
          onPress={handleSubmit(onSubmit)}
          disabled={submitting || exporting}
        >
          <Text className="text-white font-bold text-base">
            {submitting
              ? "Saving..."
              : isEditing
                ? "Update Report"
                : "Submit Report"}
          </Text>
        </Pressable>

        {/* ── PDF export — only shown when editing a saved report ───────── */}
        {isEditing && (
          <Pressable
            className={`rounded-xl py-4 items-center mt-3 border border-primary ${
              submitting || exporting ? "opacity-60" : "active:opacity-50"
            }`}
            onPress={handleExportPdf}
            disabled={submitting || exporting}
          >
            <Text className="text-primary font-bold text-base">
              {exporting ? "Generating PDF..." : "Preview & Export PDF"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
