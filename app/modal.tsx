import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModalScreen() {
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {/* Light status bar on iOS modals to contrast against the dark scrim above */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />

      <ScrollView contentContainerClassName="px-5 py-6 gap-6">

        {/* ── App header ──────────────────────────────────────────────────── */}
        <View className="items-center gap-1 pb-2">
          <Text className="text-2xl font-bold text-text">FieldReportX</Text>
          <Text className="text-sm text-textSecondary">Version {version}</Text>
          <Text className="text-sm text-textSecondary text-center mt-1">
            A field reporting tool built for professionals on the go.
          </Text>
        </View>

        {/* ── Getting Started ─────────────────────────────────────────────── */}
        <HelpSection title="Getting Started">
          <HelpItem
            heading="Creating your first report"
            body="From the Home tab, tap a template card to open a new report. Fill in the fields and tap Submit Report to save it. Your report will appear in the History tab."
          />
          <HelpItem
            heading="Report status"
            body="Every report has a status — Draft, In Progress, Completed, or Archived. Tap the status badge at the top of a report to change it before saving."
          />
        </HelpSection>

        {/* ── Field Types ─────────────────────────────────────────────────── */}
        <HelpSection title="Field Types">
          <HelpItem
            heading="Text"
            body="Free-form text entry for notes, descriptions, and observations."
          />
          <HelpItem
            heading="Camera"
            body="Capture a photo directly from the report. After taking a photo you can annotate it by drawing on the image. The photo is automatically GPS-tagged with your location."
          />
          <HelpItem
            heading="GPS"
            body="Records your current GPS coordinates at the moment you tap the capture button."
          />
          <HelpItem
            heading="GPS Map"
            body="Captures your location and saves a map snapshot with a marker showing where you were."
          />
          <HelpItem
            heading="Date & Time"
            body="Opens a date or time picker so you can log exactly when something occurred."
          />
          <HelpItem
            heading="Rating"
            body="A 1–5 star rating selector for scoring conditions, quality, or severity."
          />
          <HelpItem
            heading="Voice to Text"
            body="Tap the microphone button and speak — your words are transcribed into the field automatically."
          />
          <HelpItem
            heading="Signature"
            body="A freehand signature pad. Sign with your finger and the signature is saved as part of the report."
          />
          <HelpItem
            heading="Gyroscope Sensor"
            body="Records live motion data from the device gyroscope. Useful for logging vibration or tilt readings."
          />
        </HelpSection>

        {/* ── Managing Reports ────────────────────────────────────────────── */}
        <HelpSection title="Managing Reports">
          <HelpItem
            heading="Viewing past reports"
            body="The History tab shows all your saved reports. Tap a report to open and edit it."
          />
          <HelpItem
            heading="Exporting to PDF"
            body="Open a saved report, then tap Preview & Export PDF. You can preview the PDF or share it via email, Google Drive, WhatsApp, or any other app on your device."
          />
          <HelpItem
            heading="Draft reminders"
            body="Turn on Draft Reminders in Settings to receive a notification after a set number of hours reminding you to complete any unfinished reports. Tap the notification to go straight to your History."
          />
        </HelpSection>

        {/* ── Templates ───────────────────────────────────────────────────── */}
        <HelpSection title="Templates">
          <HelpItem
            heading="Adding templates"
            body="Go to Settings → Add Templates to download new report templates from the cloud. New templates appear on the Home screen."
          />
          <HelpItem
            heading="Removing templates"
            body="Go to Settings → Delete Templates to remove templates you no longer need."
          />
        </HelpSection>

        {/* ── Customisation ───────────────────────────────────────────────── */}
        <HelpSection title="Settings & Customisation">
          <HelpItem
            heading="Appearance"
            body="Choose from Light, Dark, Forest, or Ocean themes in Settings → Appearance."
          />
          <HelpItem
            heading="Business profile"
            body="Add your company name, contact details, and logo in Settings → Business Profile. This information appears automatically on exported PDFs when your template is set up to include it."
          />
          <HelpItem
            heading="User profile"
            body="Set your display name in Settings → User Profile. Your name appears on exported reports."
          />
        </HelpSection>

        {/* ── Tips ────────────────────────────────────────────────────────── */}
        <HelpSection title="Tips">
          <HelpItem
            heading="Low battery warning"
            body="FieldReportX will alert you if your battery drops below 15% while a report is open. Save your work promptly to avoid losing data."
          />
          <HelpItem
            heading="Required fields"
            body="Fields marked with a red asterisk (*) must be filled in before you can submit a report."
          />
          <HelpItem
            heading="Saving a draft"
            body="Set the report status to Draft before submitting if you want to save your progress and come back to it later."
          />
        </HelpSection>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Help Section ─────────────────────────────────────────────────────────────

// Groups a set of HelpItems under a labelled heading, matching the card style
// used throughout the settings and profile screens.

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-surface rounded-2xl p-4 gap-3">
      <Text className="text-sm font-semibold text-textSecondary uppercase tracking-widest">
        {title}
      </Text>
      {children}
    </View>
  );
}

// ─── Help Item ────────────────────────────────────────────────────────────────

// A single heading + body paragraph. Used inside HelpSection.

function HelpItem({ heading, body }: { heading: string; body: string }) {
  return (
    <View className="gap-1">
      <Text className="text-base font-semibold text-text">{heading}</Text>
      <Text className="text-sm text-textSecondary leading-5">{body}</Text>
    </View>
  );
}
