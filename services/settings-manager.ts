import AsyncStorage from "@react-native-async-storage/async-storage"
import { computeContentHash } from "./hash-storage"
import { PaymentMethodType } from "../types/expense"

// Storage keys
const SETTINGS_KEY = "app_settings"
const SETTINGS_HASH_KEY = "settings_sync_hash"
const SETTINGS_CHANGED_KEY = "settings_changed"

/**
 * Theme preference type
 */
export type ThemePreference = "light" | "dark" | "system"

/**
 * Application settings interface
 */
export interface AppSettings {
  theme: ThemePreference
  syncSettings: boolean // Whether to sync settings to GitHub
  defaultPaymentMethod?: PaymentMethodType // Optional default payment method
  updatedAt: string // ISO timestamp
  version: number // Schema version for migrations
}

/**
 * Default settings used when no settings are stored
 */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  syncSettings: false,
  defaultPaymentMethod: undefined,
  updatedAt: new Date().toISOString(),
  version: 2,
}

/**
 * Load settings from AsyncStorage
 * Returns DEFAULT_SETTINGS if not found or on error
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as AppSettings
      return parsed
    }
  } catch (error) {
    console.warn("Failed to load settings:", error)
  }
  return { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() }
}

/**
 * Save settings to AsyncStorage
 * Automatically updates the updatedAt timestamp
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const settingsToSave: AppSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave))
  } catch (error) {
    console.warn("Failed to save settings:", error)
    throw error
  }
}

/**
 * Mark settings as changed (pending sync)
 */
export async function markSettingsChanged(): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_CHANGED_KEY, "true")
  } catch (error) {
    console.warn("Failed to mark settings changed:", error)
  }
}

/**
 * Clear the settings changed flag (after successful sync)
 */
export async function clearSettingsChanged(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SETTINGS_CHANGED_KEY)
  } catch (error) {
    console.warn("Failed to clear settings changed flag:", error)
  }
}

/**
 * Check if settings have been changed since last sync
 */
export async function hasSettingsChanged(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(SETTINGS_CHANGED_KEY)
    return value === "true"
  } catch (error) {
    console.warn("Failed to check settings changed:", error)
    return false
  }
}

/**
 * Get the stored settings hash from last sync
 */
export async function getSettingsHash(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SETTINGS_HASH_KEY)
  } catch (error) {
    console.warn("Failed to get settings hash:", error)
    return null
  }
}

/**
 * Save the settings hash after sync
 */
export async function saveSettingsHash(hash: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_HASH_KEY, hash)
  } catch (error) {
    console.warn("Failed to save settings hash:", error)
  }
}

/**
 * Compute a hash of the settings object for change detection
 * Uses the same djb2 algorithm as file hashes
 */
export function computeSettingsHash(settings: AppSettings): string {
  // Create a stable JSON representation (sorted keys)
  const stableJson = JSON.stringify({
    defaultPaymentMethod: settings.defaultPaymentMethod,
    syncSettings: settings.syncSettings,
    theme: settings.theme,
    version: settings.version,
    // Note: updatedAt is intentionally excluded from hash
    // so that timestamp changes alone don't trigger re-sync
  })
  return computeContentHash(stableJson)
}
