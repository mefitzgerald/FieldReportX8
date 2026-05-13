import { expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage normally talks to the device. This swaps it out with a
// fake version that works in memory so the test never needs a real device.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { storageHelper } from "@/utils/storageHelper";

// The fake AsyncStorage has Jest spy functions on it, but TypeScript doesn't
// know that. This cast tells TypeScript to trust us so we can use them below.
const mockedAsyncStorage = AsyncStorage as unknown as {
  getItem: jest.Mock<(key: string) => Promise<string | null>>;
  setItem: jest.Mock<(key: string, value: string) => Promise<void>>;
  removeItem: jest.Mock<(key: string) => Promise<void>>;
};

it("saves, loads, and clears reminder preferences", async () => {
  // Plant some fake data so that when load() reads from storage it gets this back.
  mockedAsyncStorage.getItem.mockResolvedValueOnce(
    JSON.stringify({ enabled: true, hours: 6 }),
  );

  // Save: check it writes to the right key and converts the object to JSON.
  await storageHelper.reminder.save({ enabled: true, hours: 6 });
  expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
    "reminder_prefs",
    JSON.stringify({ enabled: true, hours: 6 }),
  );

  // Load: check it reads from the right key and converts the JSON back to an object.
  const prefs = await storageHelper.reminder.load();
  expect(prefs).toEqual({ enabled: true, hours: 6 });
  expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith("reminder_prefs");

  // Clear: check it deletes the right key.
  await storageHelper.reminder.clear();
  expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("reminder_prefs");
});
