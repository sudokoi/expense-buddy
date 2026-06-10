/**
 * Secure Storage Module
 *
 * Android-only secure storage using expo-secure-store.
 * On iOS the functions are no-ops returning null (iOS keychain access
 * prevented by App Store review guidelines).
 */

import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

/**
 * Secure storage interface for platform-agnostic storage operations
 */
export interface SecureStorage {
  setItem(key: string, value: string): Promise<void>
  getItem(key: string): Promise<string | null>
  deleteItem(key: string): Promise<void>
}

/**
 * Store a value securely
 * Uses SecureStore on native platforms, AsyncStorage on web
 */
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "android") {
    await SecureStore.setItemAsync(key, value)
  }
}

/**
 * Retrieve a value from secure storage
 * Returns null if the key doesn't exist
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "android") {
    return await SecureStore.getItemAsync(key)
  }
  return null
}

/**
 * Delete a value from secure storage
 */
async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "android") {
    await SecureStore.deleteItemAsync(key)
  }
}

/**
 * Secure storage instance with all operations
 */
export const secureStorage: SecureStorage = {
  setItem,
  getItem,
  deleteItem,
}

// Export individual functions for direct use
export { setItem, getItem, deleteItem }
