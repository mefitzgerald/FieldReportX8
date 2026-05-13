import { formatDateTime } from "@/utils/formatters";
import { describe, expect, it } from "@jest/globals";

describe("formatDateTime", () => {
  it("returns 'Unknown date' for null", () => {
    expect(formatDateTime(null)).toBe("Unknown date");
  });

  it("returns 'Unknown date' for undefined", () => {
    expect(formatDateTime(undefined)).toBe("Unknown date");
  });

  it("returns 'Unknown date' for an empty string", () => {
    expect(formatDateTime("")).toBe("Unknown date");
  });

  it("includes the correct year for a valid ISO string", () => {
    expect(formatDateTime("2026-05-13T12:34:00.000Z")).toContain("2026");
  });

  it("returns a non-empty string for a valid ISO string", () => {
    expect(formatDateTime("2026-05-13T12:34:00.000Z").length).toBeGreaterThan(0);
  });

  it("contains the two-space separator between date and time", () => {
    expect(formatDateTime("2026-05-13T12:34:00.000Z")).toContain("  ");
  });
});
