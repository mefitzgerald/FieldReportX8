import { expect, it } from "@jest/globals";

// Purpose:
// This is a tiny baseline test that proves the Jest runner is executing this
// file and that basic assertions are working.

it("passes a simple assertion", () => {
  // Minimal assertion used as a harness check.
  expect(1 + 1).toBe(2);
});
