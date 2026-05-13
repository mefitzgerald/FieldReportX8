import { statusLabel } from "@/utils/formatters";
import { expect, it } from "@jest/globals";

// Purpose:
// Verify that an internal status token is translated to the exact label shown
// to users in the UI.
//
// Why this matters:
// A mismatch here can create inconsistent wording across screens and exports.
it("maps report status values to readable labels", () => {
  // "completed" is a representative production status value.
  expect(statusLabel("completed")).toBe("Completed");
});
