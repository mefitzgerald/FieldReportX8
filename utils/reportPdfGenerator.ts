import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { BusinessProfileRow, ReportFieldRow, ReportRow } from "./sqliteHelper"; // 👈 adjust path

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfReportData {
  report: ReportRow;
  fields: ReportFieldRow[];
  businessProfile: BusinessProfileRow | null;
  userDisplayName: string | null;
}

// ─── Image helper ─────────────────────────────────────────────────────────────

// Convert a local file URI to a base64 data URI so it embeds in HTML
const imageUriToBase64 = async (uri: string): Promise<string | null> => {
  try {
    console.log("[PdfGenerator] Converting image to base64:", uri);
    const base64 = await new File(uri).base64();
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.warn("[PdfGenerator] Failed to convert image to base64:", error);
    return null;
  }
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

const buildReportHtml = async (data: PdfReportData): Promise<string> => {
  const { report, fields, businessProfile, userDisplayName } = data;

  // Only show business sections if the layout flag is set AND
  // a business profile actually exists — prevents empty sections
  // if the user hasn't set up their business profile yet
  const hasBusinessProfile = businessProfile !== null;
  const showLogo =
    report.reportLayoutLogo === 1 &&
    hasBusinessProfile &&
    !!businessProfile?.companyLogo;
  const showCompanyName =
    report.reportLayoutCompanyName === 1 &&
    hasBusinessProfile &&
    !!businessProfile?.companyName;
  const showContactDetails =
    report.reportLayoutContactDetails === 1 && hasBusinessProfile;

  // Format the report creation date
  const reportDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Unknown date";

  // ── Build logo HTML ────────────────────────────────────────────────────────

  let logoHtml = "";
  if (showLogo && businessProfile?.companyLogo) {
    const base64Logo = await imageUriToBase64(businessProfile.companyLogo);
    if (base64Logo) {
      logoHtml = `<img src="${base64Logo}" style="max-height: 80px; max-width: 200px; object-fit: contain;" />`;
    }
  }

  // ── Build field rows HTML ──────────────────────────────────────────────────

  let fieldsHtml = "";
  for (const field of fields) {
    const label = field.fieldLabel ?? "Field";
    const type = field.fieldType ?? "text";
    let valueHtml = "<em>No data</em>";

    if (field.fieldData) {
      if (type === "camera" || type === "sign" || type === "gps_map") {
        // Convert image URI to base64 for inline embedding.
        // camera = annotated photo, sign = signature PNG, gps_map = map snapshot PNG.
        const base64Image = await imageUriToBase64(field.fieldData);
        if (base64Image) {
          valueHtml = `<img src="${base64Image}" style="max-width: 100%; max-height: 300px; border-radius: 6px; object-fit: contain;" />`;
        } else {
          valueHtml = "<em>Image unavailable</em>";
        }
      } else if (type === "sensor_gyro" || type === "sensor_speed") {
        // Parse sensor JSON and display as a small table
        try {
          const sensorData = JSON.parse(field.fieldData);
          valueHtml = `
            <table style="border-collapse: collapse; font-family: monospace; font-size: 13px;">
              <tr><td style="padding: 2px 12px 2px 0; color: #666;">X</td><td>${sensorData.x?.toFixed(4) ?? "—"}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; color: #666;">Y</td><td>${sensorData.y?.toFixed(4) ?? "—"}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; color: #666;">Z</td><td>${sensorData.z?.toFixed(4) ?? "—"}</td></tr>
            </table>`;
        } catch {
          valueHtml = field.fieldData;
        }
      } else {
        // Plain text — escape HTML characters for safety
        valueHtml = field.fieldData
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
    }

    fieldsHtml += `
      <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.5px; color: #888; margin-bottom: 6px;">
          ${label}${field.fieldRequired === 1 ? ' <span style="color: #FF3B30;">*</span>' : ""}
        </div>
        <div style="font-size: 15px; color: #1a1a1a;">${valueHtml}</div>
      </div>`;
  }

  // ── Assemble full HTML document ────────────────────────────────────────────

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, Helvetica, Arial, sans-serif;
          color: #1a1a1a;
          padding: 40px;
          font-size: 14px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #1a1a1a;
        }
        .header-left { flex: 1; }
        .header-right { text-align: right; margin-left: 24px; }
        .report-name {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .report-meta {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .status-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f0f0f0;
          color: #555;
          margin-top: 8px;
        }
        .company-name {
          font-size: 16px;
          font-weight: 600;
          margin-top: 8px;
        }
        .fields { margin-top: 8px; }
        .footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #eee;
          font-size: 11px;
          color: #aaa;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .footer-left { display: flex; flex-direction: column; gap: 2px; }
        .footer-right { text-align: right; white-space: nowrap; }
      </style>
    </head>
    <body>

      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <div class="report-name">${report.reportName ?? "Report"}</div>
          <div class="report-meta">Date: ${reportDate}</div>
          <div class="status-badge">${report.reportStatus ?? "draft"}</div>
        </div>
        <div class="header-right">
          ${logoHtml ? `<div style="margin-bottom: 10px;">${logoHtml}</div>` : ""}
          ${
            showCompanyName && businessProfile?.companyName
              ? `<div class="company-name">${businessProfile.companyName}</div>`
              : ""
          }
          ${
            showContactDetails && businessProfile?.companyEmail
              ? `<div class="report-meta">${businessProfile.companyEmail}</div>`
              : ""
          }
          ${
            showContactDetails && businessProfile?.companyPhoneNumber
              ? `<div class="report-meta">${businessProfile.companyPhoneNumber}</div>`
              : ""
          }
        </div>
      </div>

      <!-- Fields -->
      <div class="fields">
        ${fieldsHtml || "<p style='color: #999; font-style: italic;'>No field data recorded.</p>"}
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-left">
          <span>Generated by FieldReportX</span>
          ${report.reportCategory ? `<span>Category: ${report.reportCategory}</span>` : ""}
          ${userDisplayName ? `<span>Prepared by: ${userDisplayName}</span>` : ""}
        </div>
        <div class="footer-right">Checksum: ${report.reportChecksum ?? "—"}</div>
      </div>

    </body>
    </html>`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Opens the native print/PDF preview for a report.
 * The user can save as PDF or print directly from the preview.
 */
export const previewReportPdf = async (data: PdfReportData): Promise<void> => {
  console.log("[PdfGenerator] Building HTML for report:", data.report.reportId);

  const html = await buildReportHtml(data);

  // Determine orientation from the report layout field
  const isLandscape = data.report.reportLayout?.toLowerCase() === "landscape";

  console.log("[PdfGenerator] Opening print preview, landscape:", isLandscape);

  await Print.printAsync({
    html,
    orientation: isLandscape
      ? Print.Orientation.landscape
      : Print.Orientation.portrait,
  });
};

/**
 * Generates a PDF file and opens the native share sheet
 * so the user can save or send it.
 */
export const shareReportPdf = async (
  data: PdfReportData,
  fileName?: string,
): Promise<void> => {
  console.log(
    "[PdfGenerator] Generating PDF for report:",
    data.report.reportId,
  );

  const html = await buildReportHtml(data);
  const isLandscape = data.report.reportLayout?.toLowerCase() === "landscape";

  // Generate the PDF file
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  console.log("[PdfGenerator] PDF generated at:", uri);

  // Open share sheet directly with the generated URI
  // (skip the rename step to avoid expo-file-system dependency)
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${data.report.reportName ?? "Report"}`,
    });
  } else {
    console.warn("[PdfGenerator] Sharing not available on this device");
  }
};
