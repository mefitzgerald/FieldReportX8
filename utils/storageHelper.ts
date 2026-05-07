import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "firebase/auth";

/**
 * Generic AsyncStorage helper for key-value pair operations
 */
export const storageHelper = {
  /**
   * Set a generic key-value pair
   */
  setItem: async (key: string, value: any): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  },

  /**
   * Get a generic key-value pair
   */
  getItem: async (key: string): Promise<any> => {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
      return null;
    }
  },

  /**
   * Remove a key-value pair
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from storage:`, error);
    }
  },

  /**
   * Clear all storage
   */
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  },

  /**
   * Draft reminder preference helpers.
   *
   * Stored in AsyncStorage as JSON: { enabled: boolean, hours: number }
   * AsyncStorage on Android is backed by SQLite — it persists across app
   * restarts and survives in the background, but is cleared on uninstall.
   */
  reminder: {
    save: async (prefs: { enabled: boolean; hours: number }): Promise<void> => {
      await storageHelper.setItem("reminder_prefs", prefs);
    },

    load: async (): Promise<{ enabled: boolean; hours: number } | null> => {
      return await storageHelper.getItem("reminder_prefs");
    },

    clear: async (): Promise<void> => {
      await storageHelper.removeItem("reminder_prefs");
    },
  },

  /**
   * User-specific helper functions
   */
  user: {
    save: async (user: User | null): Promise<void> => {
      if (user) {
        await storageHelper.setItem("user", {
          uid: user.uid,
          email: user.email,
        });
      } else {
        await storageHelper.removeItem("user");
      }
    },

    load: async (): Promise<any> => {
      return await storageHelper.getItem("user");
    },
  },
};
