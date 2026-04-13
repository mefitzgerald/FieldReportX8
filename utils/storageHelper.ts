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
