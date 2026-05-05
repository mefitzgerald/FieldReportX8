import defaultTemplates from "@/assets/templates/defaulttemplate.json"; // Default templates to seed for new users
import { jsonToDbHelper } from "@/utils/jsonToDbHelper";
import { sqliteHelper } from "@/utils/sqliteHelper";
import { storageHelper } from "@/utils/storageHelper";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
  UserCredential,
} from "firebase/auth";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { registerForPushNotifications } from "@/utils/notificationHelper";
import { auth } from "../firebaseConfig";

// Types for our auth context value, including user info and auth actions.

export interface AuthContextValue {
  /** The authenticated Firebase user, or null if not logged in */
  user: User | null;
  /** Whether the user is currently logged in */
  isLoggedIn: boolean;
  /** True while the initial auth state is being resolved */
  isLoading: boolean;
  /** Sign in with email and password */
  login: (email: string, password: string) => Promise<UserCredential>;
  /** Register a new user with email and password */
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<UserCredential>;
  /** Sign out the current user */
  logout: () => Promise<void>;
  /** Update the current user's display name / photo */
  updateUser: (updates: {
    displayName?: string;
    photoURL?: string;
  }) => Promise<void>;
  /** Delete user account */
  deleteAccount: () => Promise<void>;
}

// Context that will hold the auth state and actions, initialized with null to enforce
// provider usage.

const AuthContext = createContext<AuthContextValue | null>(null);

// Provider that wraps app and makes auth object available to any child component
// that calls useAuth().

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Seed state from AsyncStorage before Firebase resolves
  // This prevents a flash of "logged out" UI on cold start while Firebase
  // is still rehydrating its auth token.
  useEffect(() => {
    const seedFromStorage = async () => {
      const cached = await storageHelper.user.load();
      if (cached) {
        // We only use this as a loading hint — Firebase is the source of truth.
        // Setting a non-null placeholder keeps isLoggedIn true during the gap.
        setUser(cached as unknown as User);
      }
    };
    seedFromStorage();
  }, []);

  // Subscribe to Firebase auth state changes and update context state accordingly.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await storageHelper.user.save(firebaseUser); // keep cache in sync
      if (firebaseUser) {
        registerForPushNotifications(firebaseUser.uid).catch((e) =>
          console.warn("[AuthContext] Push registration failed:", e)
        );
      }
      setIsLoading(false);
    });

    return unsubscribe; // cleanup on unmount
  }, []);

  // Actions

  const login = useCallback(
    (email: string, password: string) =>
      signInWithEmailAndPassword(auth, email, password),
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
    ): Promise<UserCredential> => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      // Update the Firebase user profile with the display name immediately after registration
      await updateProfile(credential.user, { displayName });
      // Save the new user to SQLite after Firebase confirms the account
      const userId = await sqliteHelper.user.save({
        userEmail: credential.user.email!,
        userFirebaseUid: credential.user.uid,
        userDisplayName: displayName ?? null,
      });
      console.log(
        `Registered new user with ID ${userId} and email ${credential.user.email}`,
      );
      // Seed default templates for new user
      await jsonToDbHelper.insertJsonToDb(userId, defaultTemplates);

      return credential;
    },
    [],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    await storageHelper.user.save(null); // explicit clear (onAuthStateChanged also fires)
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) throw new Error("No authenticated user to delete."); //gotta say this is unlikely.

    // Step 1 — resolve local SQLite userId
    const localUser = await sqliteHelper.user.getByFirebaseUid(user.uid);
    if (!localUser?.userId)
      throw new Error("Could not find local user record.");

    // Step 2 — delete from SQLite first (cascades to all related data)
    await sqliteHelper.user.delete(localUser.userId);

    // Step 3 — clear AsyncStorage cache
    await storageHelper.user.save(null);

    // Step 4 — delete Firebase account
    // This can throw "auth/requires-recent-login" if the session is old
    await deleteUser(user);
  }, [user]);

  const updateUser = useCallback(
    async (updates: { displayName?: string; photoURL?: string }) => {
      if (!user) throw new Error("No authenticated user to update.");
      await updateProfile(user, updates);
      await storageHelper.user.save(user); // re-persist with latest profile
      // Force a local state refresh — Firebase doesn't re-emit onAuthStateChanged
      // for profile-only updates.
      setUser({ ...user, ...updates } as User);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access auth state and actions anywhere inside <AuthProvider>.
 *
 * @example
 * const { isLoggedIn, user, login, logout } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return context;
}
