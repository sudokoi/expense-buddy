import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { computeContentHash } from "./hash-storage"
import { PaymentMethodType } from "../types/expense"
import { Category } from "../types/category"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"
import { PaymentInstrument } from "../types/payment-instrument"

// Storage keys
const SETTINGS_KEY = "app_settings"
const SETTINGS_HASH_KEY = "settings_sync_hash"
const SETTINGS_CHANGED_KEY = "settings_changed"

// Old auto-sync storage keys (for migration from v2 to v3)
const OLD_AUTO_SYNC_ENABLED_KEY = "auto_sync_enabled"
const OLD_AUTO_SYNC_TIMING_KEY = "auto_sync_timing"

/**
 * Theme preference type
 */
export type ThemePreference = "light" | "dark" | "system"

/**
 * Auto-sync timing options
 */
export type AutoSyncTiming = "on_launch" | "on_change"

/**
 * Application settings interface
 */
export interface AppSettings {
  theme: ThemePreference
  syncSettings: boolean // Whether to sync settings to GitHub
  defaultPaymentMethod?: PaymentMethodType // Optional default payment method
  defaultCurrency: string // Default currency code (e.g., "INR")
  autoSyncEnabled: boolean // Whether auto-sync is enabled
  autoSyncTiming: AutoSyncTiming // When to trigger auto-sync
  categories: Category[] // User-defined expense categories
  categoriesVersion: number // Schema version for category migrations
  paymentInstruments: PaymentInstrument[] // Saved card/UPI instruments (synced if syncSettings is enabled)
  paymentInstrumentsMigrationVersion: number // One-time migration state for instrument linking
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
  defaultCurrency: "INR",
  autoSyncEnabled: false,
  autoSyncTiming: "on_launch",
  categories: DEFAULT_CATEGORIES,
  categoriesVersion: 1,
  paymentInstruments: [],
  paymentInstrumentsMigrationVersion: 0,
  updatedAt: new Date().toISOString(),
  version: 5,
}

/**
 * Hydrate a settings-like JSON object into a full AppSettings object.
 *
 * Used for:
 * - local AsyncStorage load (after parsing)
 * - remote settings.json download (older versions may miss newer fields)
 */
export function hydrateSettingsFromJson(raw: unknown): AppSettings {
  const parsed = (raw ?? {}) as Partial<AppSettings>

  // Apply pure migrations that don't rely on device-only storage keys.
  let migrated: Partial<AppSettings> = parsed

  const version = typeof migrated.version === "number" ? migrated.version : 0

  if (version > 0 && version < 4) {
    migrated = migrateV3ToV4(migrated as AppSettings)
  }

  if ((typeof migrated.version === "number" ? migrated.version : version) < 5) {
    migrated = migrateV4ToV5(migrated as AppSettings)
  }

  return {
    theme: migrated.theme ?? DEFAULT_SETTINGS.theme,
    syncSettings: migrated.syncSettings ?? DEFAULT_SETTINGS.syncSettings,
    defaultPaymentMethod: (migrated as AppSettings).defaultPaymentMethod,
    defaultCurrency:
      (migrated as AppSettings).defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
    autoSyncEnabled: migrated.autoSyncEnabled ?? DEFAULT_SETTINGS.autoSyncEnabled,
    autoSyncTiming: migrated.autoSyncTiming ?? DEFAULT_SETTINGS.autoSyncTiming,
    categories: migrated.categories ?? DEFAULT_CATEGORIES,
    categoriesVersion: migrated.categoriesVersion ?? DEFAULT_SETTINGS.categoriesVersion,
    paymentInstruments: migrated.paymentInstruments ?? [],
    paymentInstrumentsMigrationVersion:
      migrated.paymentInstrumentsMigrationVersion ??
      DEFAULT_SETTINGS.paymentInstrumentsMigrationVersion,
    updatedAt: migrated.updatedAt ?? new Date().toISOString(),
    version:
      typeof migrated.version === "number"
        ? Math.max(migrated.version, DEFAULT_SETTINGS.version)
        : DEFAULT_SETTINGS.version,
  }
}

// Helper functions for secure storage with platform check (same as sync-manager.ts)
async function secureGetItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key)
  } else {
    return await SecureStore.getItemAsync(key)
  }
}

async function secureDeleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key)
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

/**
 * Migrate settings from version 2 to version 3
 * Moves auto-sync settings from separate storage keys to AppSettings
 */
async function migrateV2ToV3(settings: AppSettings): Promise<AppSettings> {
  // Load old auto-sync settings from secure storage
  const oldEnabled = await secureGetItem(OLD_AUTO_SYNC_ENABLED_KEY)
  const oldTiming = await secureGetItem(OLD_AUTO_SYNC_TIMING_KEY)

  // Migrate old "on_expense_entry" to "on_change" (same as sync-manager.ts)
  let timing: AutoSyncTiming = "on_launch"
  if (oldTiming === "on_expense_entry" || oldTiming === "on_change") {
    timing = "on_change"
  } else if (oldTiming === "on_launch") {
    timing = "on_launch"
  }

  const migrated: AppSettings = {
    ...settings,
    autoSyncEnabled: oldEnabled === "true",
    autoSyncTiming: timing,
    version: 3,
  }

  // Clean up old keys after migration
  try {
    await secureDeleteItem(OLD_AUTO_SYNC_ENABLED_KEY)
    await secureDeleteItem(OLD_AUTO_SYNC_TIMING_KEY)
  } catch (error) {
    console.warn("Failed to clean up old auto-sync keys:", error)
    // Continue even if cleanup fails - migration is still successful
  }

  return migrated
}

/**
 * Migrate settings from version 3 to version 4
 * Adds categories field with default categories
 */
function migrateV3ToV4(settings: AppSettings): AppSettings {
  return {
    ...settings,
    categories: DEFAULT_CATEGORIES,
    categoriesVersion: 1,
    version: 4,
  }
}

/**
 * Migrate settings from version 4 to version 5
 * Adds paymentInstruments field
 */
function migrateV4ToV5(settings: AppSettings): AppSettings {
  return {
    ...settings,
    paymentInstruments: settings.paymentInstruments ?? [],
    paymentInstrumentsMigrationVersion: settings.paymentInstrumentsMigrationVersion ?? 0,
    version: 5,
  }
}

/**
 * Load settings from AsyncStorage
 * Returns DEFAULT_SETTINGS if not found or on error
 * Performs migration from older versions if needed
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY)
    if (stored) {
      let parsed = JSON.parse(stored) as AppSettings

      // Migrate if needed (version < 3)
      if (!parsed.version || parsed.version < 3) {
        parsed = await migrateV2ToV3(parsed)
        await saveSettings(parsed)
      }

      // Migrate from v3 to v4 (add categories)
      if (parsed.version < 4) {
        parsed = migrateV3ToV4(parsed)
        await saveSettings(parsed)
      }

      // Migrate from v4 to v5 (add payment instruments)
      if (parsed.version < 5) {
        parsed = migrateV4ToV5(parsed)
        await saveSettings(parsed)
      }

      return hydrateSettingsFromJson(parsed)
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
  // Categories are sorted by label for consistent hashing
  const sortedCategories = [...settings.categories].sort((a, b) =>
    a.label.localeCompare(b.label)
  )
  const sortedInstruments = [...settings.paymentInstruments]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((inst) => ({
      id: inst.id,
      method: inst.method,
      nickname: inst.nickname,
      lastDigits: inst.lastDigits,
      deletedAt: inst.deletedAt,
      // Note: createdAt/updatedAt intentionally excluded from hash
    }))

  const stableJson = JSON.stringify({
    autoSyncEnabled: settings.autoSyncEnabled,
    autoSyncTiming: settings.autoSyncTiming,
    categories: sortedCategories.map((c) => ({
      color: c.color,
      icon: c.icon,
      isDefault: c.isDefault,
      label: c.label,
      order: c.order,
      // Note: updatedAt is intentionally excluded from hash
      // so that timestamp changes alone don't trigger re-sync
    })),
    categoriesVersion: settings.categoriesVersion,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    defaultCurrency: settings.defaultCurrency,
    paymentInstruments: sortedInstruments,
    syncSettings: settings.syncSettings,
    theme: settings.theme,
    version: settings.version,
    // Note: updatedAt is intentionally excluded from hash
    // so that timestamp changes alone don't trigger re-sync
  })
  return computeContentHash(stableJson)
}
