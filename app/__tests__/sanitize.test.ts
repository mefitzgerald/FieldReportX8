import { sanitizeText } from "@/utils/sanitize";
import { expect, it } from "@jest/globals";

// Purpose:
// Confirm that sanitizeText escapes the key HTML-sensitive characters so user
// text is treated as plain text instead of markup.
//
// Why this matters:
// This prevents accidental rendering issues and reduces injection risk when
// text is later displayed in HTML-like contexts.
it("escapes HTML special characters", () => {
  // Input contains all major characters we care about escaping in one string.
  expect(sanitizeText(`Tom & <Jerry> "it's"`)).toBe(
    // Expected escaped output for &, <, >, ", and '.
    "Tom &amp; &lt;Jerry&gt; &quot;it&#x27;s&quot;",
  );
});
