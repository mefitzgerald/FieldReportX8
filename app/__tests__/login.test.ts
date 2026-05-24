import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

// ─── Mocks ────────────────────────────────────────────────────────────────────
//
// jest.mock() calls are hoisted by Jest to run BEFORE any imports, even though
// they appear after them in the code. This means by the time LoginScreen loads,
// every dependency is already replaced with a fake — the real Firebase and
// AuthContext are never initialised or called during any test.

// jest.fn() creates a fake function that:
//   - Records every call made to it (arguments, call count)
//   - Returns whatever we tell it to via mockResolvedValueOnce
//   - Does nothing by default otherwise
// Typed as () => Promise<void> so mockResolvedValueOnce(undefined) is valid.
const mockLogin = jest.fn<() => Promise<void>>();
const mockRegister = jest.fn<() => Promise<void>>();

// Replace AuthContext with a minimal fake. When LoginScreen calls useAuth()
// it receives mockLogin and mockRegister instead of the real Firebase functions.
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

// Provide a FirebaseError class with the correct shape so the login screen's
// error-code switch statement works without a real Firebase SDK being loaded.
jest.mock("firebase/app", () => ({
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  },
}));

// sendPasswordResetEmail is imported by the login screen — a no-op mock is enough.
jest.mock("firebase/auth", () => ({ sendPasswordResetEmail: jest.fn() }));

// The login screen imports the shared Firebase auth instance.
// An empty object satisfies the import without initialising a real Firebase app.
jest.mock("@/firebaseConfig", () => ({ auth: {} }));

// SafeAreaView is a native-only module that cannot run in Node.js (Jest's environment).
// Replacing it with a plain View lets the component render without a real device.
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

import LoginScreen from "@/app/login";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear call history and return values between tests so nothing leaks between them
  jest.clearAllMocks();
  // Replace Alert.alert with a spy so we can assert on it without a real dialog appearing
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

// ─── Smoke test ───────────────────────────────────────────────────────────────

// Confirms the module loads successfully with all dependencies mocked.
// If any import path is broken or a module throws on load, this fails first.
it("loads the login screen module", () => {
  expect(typeof LoginScreen).toBe("function");
});

// ─── Login flow ───────────────────────────────────────────────────────────────

describe("login flow", () => {
  it("calls login with the entered email and password", async () => {
    // Tell mockLogin to resolve successfully for this test
    mockLogin.mockResolvedValueOnce(undefined);

    // Render the screen and fill in valid credentials
    const { getByPlaceholderText, getByText } = render(React.createElement(LoginScreen));
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Sign in"));

    // Assert mockLogin was called with exactly the values the user typed.
    // waitFor retries until the assertion passes or times out (handles async state updates).
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
    });
  });

  it("blocks login and alerts when fields are empty", async () => {
    const { getByText } = render(React.createElement(LoginScreen));

    // Press Sign in without filling in any fields
    fireEvent.press(getByText("Sign in"));

    // The screen's validation should fire an alert and never call mockLogin
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter your email and password");
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  it("blocks login and alerts when email format is invalid", async () => {
    const { getByPlaceholderText, getByText } = render(React.createElement(LoginScreen));

    // Enter a string that fails the email regex check in the screen
    fireEvent.changeText(getByPlaceholderText("Email"), "notanemail");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Sign in"));

    // Client-side validation should catch the bad format before Firebase is called
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter a valid email address");
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });
});
