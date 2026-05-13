import { expect, it, jest } from "@jest/globals";

// Even though the import appears before these mock calls in the code, Jest
// secretly runs all jest.mock() calls first. That means by the time the
// login screen loads, all four Firebase dependencies are already swapped
// out for fakes — the real Firebase never gets called.

// Dummy functions satisfy the shape useAuth() returns inside the screen.
const mockLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

// The login screen maps Firebase error codes to user-facing messages.
// This stub gives the FirebaseError class the right shape without a real SDK.
jest.mock("firebase/app", () => ({
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

// The login screen imports sendPasswordResetEmail for the forgot-password flow.
jest.mock("firebase/auth", () => ({
  sendPasswordResetEmail: jest.fn(),
}));

// The screen imports the shared auth instance from firebaseConfig.
// An empty object is enough — no real Firebase app is initialised.
jest.mock("@/firebaseConfig", () => ({
  auth: {},
}));

import LoginScreen from "@/app/login";

// Smoke test: confirms the module resolves to a component with all its
// dependencies mocked. If import-time wiring breaks (bad path, missing export,
// module that throws on load) this will fail before any UI test runs.
it("loads the login screen module", () => {
  expect(typeof LoginScreen).toBe("function");
});
