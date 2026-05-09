# FieldReportX

A field reporting mobile app built for professionals on the go. FieldReportX lets users create structured inspection and field reports from customisable templates, capture photos, GPS locations, signatures, pose analysis, and more — then export polished PDFs with company branding.

Built with React Native (Expo), TypeScript, NativeWind, Firebase Auth, and SQLite.

---

## Features

- **Custom report templates** — download templates from the cloud and fill them out on-site
- **Multiple field types** — text, camera with annotation, GPS, maps, date/time, rating, voice-to-text, signature, gyroscope, and pose capture
- **PDF export** — generate and share branded PDF reports via email, Google Drive, WhatsApp, or any installed app
- **Report comparison** — side-by-side comparison of two reports for the same property
- **Business profile** — stamp your company name, logo, and contact details onto every PDF
- **Themes** — Light, Dark, Forest, and Ocean colour themes
- **Draft reminders** — push notifications to remind you to complete unfinished reports
- **Offline-first** — all data stored locally in SQLite

---

## Tech Stack

| Layer          | Technology                        |
| -------------- | --------------------------------- |
| Framework      | React Native + Expo SDK 55        |
| Language       | TypeScript                        |
| Styling        | NativeWind (Tailwind CSS)         |
| Auth           | Firebase Authentication           |
| Database       | SQLite via expo-sqlite            |
| PDF            | expo-print + expo-sharing         |
| Camera         | expo-camera                       |
| Maps           | react-native-maps                 |
| Pose Detection | @mefitzgerald/expo-pose-detection |
| Annotation     | @shopify/react-native-skia        |
| Build          | EAS Build                         |

---

## User Manual

### 1. Getting Started

#### 1.1 Creating an Account

Open FieldReportX and tap **Create one** on the login screen. Enter your display name, email address, and a password of at least six characters, then tap **Create Account**. You will be logged in automatically.

#### 1.2 Signing In

Enter your registered email address and password and tap **Sign in**. If you have forgotten your password, enter your email address and tap **Forgot password?** — a reset link will be sent to your inbox.

#### 1.3 Navigation

The app has three main tabs at the bottom of the screen:

- **Home** — browse report templates and start new reports
- **History** — view and manage all previously saved reports
- **Settings** — manage your profile, business details, themes, and templates

---

### 2. Creating and Submitting Reports

#### 2.1 Starting a Report

From the **Home** tab, tap any template name to open a new report. The report form loads all fields defined by that template. A status badge at the top of the form shows the current report status — tap it to change it.

**Report statuses:**

- **Draft** — work in progress, not yet complete
- **In Progress** — actively being filled out
- **Completed** — finalised and ready for export
- **Archived** — stored for reference, no longer active

#### 2.2 Field Types

**Text** — Free-form text entry for notes, descriptions, and observations.

**Camera** — Tap **Open Camera** to take a photo. Once captured, tap **Annotate Photo** to draw on the image using the built-in pen tool. Choose a pen colour and size from the toolbar, draw directly on the photo, then tap **Confirm** to save. The photo is automatically GPS-tagged with your location at the time of capture.

**Voice to Text** — Tap the microphone button and speak. Your words are transcribed into the field automatically. Tap again to stop recording. You can also manually enter text in the text field.

**GPS** — Tap the capture button to record your current GPS coordinates. The latitude and longitude are saved as the field value.

**GPS Map** — Similar to GPS, but also saves a map image with a pin marking your exact location.

**Date & Time** — Opens a date or time picker. Scroll to select the correct date or time and confirm.

**Rating** — A 1–5 star selector. Tap a star to set the rating.

**Signature** — Sign with your finger in the signature pad. Tap **Clear** to start again, or **Confirm** to save the signature.

**Gyroscope Sensor** — Records live motion data from the device gyroscope. Useful for logging vibration, tilt, or orientation readings at the time of inspection.

**Pose Capture** — Tap **Capture Pose** to open the camera. Once you tap **Detect**, the app analyses the subject's body pose using on-device machine learning. The photo is overlaid with a skeleton diagram and joint angle labels, then saved as a single composite image.

#### 2.3 Required Fields

Fields marked with a red asterisk (**\***) must be completed before the report can be submitted. If you tap **Submit Report** with required fields missing, an alert will appear prompting you to complete them.

#### 2.4 Submitting a Report

Once all required fields are filled, tap **Submit Report** at the bottom of the form. The report is saved to your device and will appear in the **History** tab.

---

### 3. Managing Reports

#### 3.1 Viewing Past Reports

The **History** tab lists all saved reports in order. Tap any report to open it. You can edit field values, change the status, or export the report to PDF.

#### 3.2 Exporting to PDF

Open a saved report and tap **Preview & Export PDF**. A PDF is generated using your report data and business profile details. You can preview it on screen or share it via email, Google Drive, WhatsApp, or any other app installed on your device.

#### 3.3 Comparing Reports

From the **Home** tab, navigate to the Compare screen. Enter a **Property ID** and tap **Search**. If two or more reports exist for that property, the two most recent are displayed side by side. Each field is shown as a pair of columns — one per report — so differences between inspections are immediately visible. Photo fields render as thumbnail images.

#### 3.4 Draft Reminders

Turn on Draft Reminders in **Settings** to receive a notification after a set number of hours reminding you to complete any unfinished reports. Tapping the notification takes you directly to the History tab.

---

### 4. Settings & Customisation

#### 4.1 Appearance

Go to **Settings → Appearance** to choose a colour theme. Four themes are available: **Light**, **Dark**, **Forest**, and **Ocean**. The theme applies immediately across the whole app.

#### 4.2 Business Profile

Go to **Settings → Business Profile** to enter your company name, business email, website, address, and phone number. You can also upload a company logo by tapping the logo area and selecting an image from your photo library. This information is stamped onto exported PDFs automatically.

#### 4.3 User Profile

Go to **Settings → User Profile** to update your display name. Your name appears on exported reports.

#### 4.4 Templates

**Adding templates** — Go to **Settings → Add Templates** to download report templates from the cloud. New templates appear as cards on the Home screen.

**Removing templates** — Go to **Settings → Delete Templates** to remove templates you no longer need. Note that the default template cannot be deleted.

---

### 5. Tips & Notes

- **Low battery warning** — FieldReportX will alert you if your battery drops below 15% while a report is open. Save your progress promptly to avoid losing data.
- **Saving a draft** — Set the report status to **Draft** before submitting if you want to save progress and return to the report later.
- **Camera fields** — Only one camera field can be active at a time. If another field is already using the camera, an alert will appear asking you to close it first.
- **Photo persistence** — All captured photos and annotated images are saved to your device's local storage and remain available even if the original photo is deleted from your gallery.

---

## Building

This project uses [EAS Build](https://docs.expo.dev/build/introduction/).

```bash
# Preview APK (Android)
eas build --profile preview --platform android

# Production
eas build --profile production --platform android
```
