import { beforeEach, expect, it, jest } from "@jest/globals";

// The AsyncStorage mock is a real in-memory implementation — it actually stores
// and retrieves values just like the device would, but without needing a device.
// This makes the test a true integration test: save → load → clear are tested
// as a real round-trip through the full storageHelper + AsyncStorage stack.
// No return values are planted — the data flows naturally through the system.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { storageHelper } from "@/utils/storageHelper";

beforeEach(async () => {
  // Clear in-memory storage between tests so each one starts with a clean slate
  await storageHelper.reminder.clear();
});

// save and load sample report completion reminder preferences, then check the loaded value matches what was saved.
it("save persists preferences that load can retrieve", async () => {
  await storageHelper.reminder.save({ enabled: true, hours: 6 });
  const prefs = await storageHelper.reminder.load();
  expect(prefs).toEqual({ enabled: true, hours: 6 });
});

// check the value is null when nothing is saved, to confirm load is correctly returning null and not some default value or error
it("load returns null when nothing has been saved", async () => {
  const prefs = await storageHelper.reminder.load();
  expect(prefs).toBeNull();
});

// confirm the clear works (if user toggles off reminders, we want to clear the saved preferences so load returns null rather than the old preferences)
it("clear removes saved preferences so load returns null", async () => {
  await storageHelper.reminder.save({ enabled: true, hours: 6 });
  await storageHelper.reminder.clear();
  const prefs = await storageHelper.reminder.load();
  expect(prefs).toBeNull();
});

// confirm that if user changes the report completion reminder duration the new value is saved and overwrites the previous value, rather than creating multiple saved preferences or being ignored
it("saving new preferences overwrites the previous ones", async () => {
  await storageHelper.reminder.save({ enabled: true, hours: 6 });
  await storageHelper.reminder.save({ enabled: false, hours: 24 });
  const prefs = await storageHelper.reminder.load();
  expect(prefs).toEqual({ enabled: false, hours: 24 });
});
