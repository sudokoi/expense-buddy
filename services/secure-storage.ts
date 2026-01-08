/**
 * Secure Storage Module
 *
 * Platform-aware secure storage abstraction that uses:
 * - expo-secure-store on native platforms (iOS/Android)
 * - @react-native-async-storage/async-storage on web
 *
 * This module provides a unified interface for storing sensitive data
 * like authentication tokens and configuration.
 */

import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
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
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value)
  } else {
    await SecureStore.setItemAsync(key, value)
  }
}

/**
 * Retrieve a value from secure storage
 * Returns null if the key doesn't exist
 */
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key)
  } else {
    return await SecureStore.getItemAsync(key)
  }
}

/**
 * Delete a value from secure storage
 */
async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key)
  } else {
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
