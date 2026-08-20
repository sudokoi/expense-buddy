import { getItem, getItemSync, setItem, removeItem } from "./storage"
import { secureStorage } from "./secure-storage"
import { computeContentHash } from "./hash-storage"
import { PaymentMethodType } from "../types/expense"
import { Category } from "../types/category"
import { DEFAULT_CATEGORIES } from "../constants/default-categories"
import { PaymentInstrument } from "../types/payment-instrument"
import { getSystemCurrency } from "../utils/currency"

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
  language: string // App language (e.g., "en-US", "system")
  enableMathExpressions: boolean // Whether amount inputs accept arithmetic expressions
  useMlOnlyForSmsImports: boolean // Whether SMS import category suggestions should prefer ML-only inference
  backgroundSmsImportEnabled: boolean // Whether background SMS transaction alerts are enabled on Android
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
  defaultCurrency: getSystemCurrency(),
  language: "system",
  enableMathExpressions: true,
  useMlOnlyForSmsImports: false,
  backgroundSmsImportEnabled: false,
  autoSyncEnabled: false,
  autoSyncTiming: "on_launch",
  categories: DEFAULT_CATEGORIES,
  categoriesVersion: 1,
  paymentInstruments: [],
  paymentInstrumentsMigrationVersion: 0,
  updatedAt: new Date().toISOString(),
  version: 9,
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

  if ((typeof migrated.version === "number" ? migrated.version : version) < 6) {
    // Pure hydration fallback (loadSettings handles async migration from storage)
    migrated = { ...migrated, language: migrated.language ?? "system", version: 6 }
  }

  if ((typeof migrated.version === "number" ? migrated.version : version) < 7) {
    migrated = migrateV6ToV7(migrated as AppSettings)
  }

  if ((typeof migrated.version === "number" ? migrated.version : version) < 8) {
    migrated = migrateV7ToV8(migrated as AppSettings)
  }

  if ((typeof migrated.version === "number" ? migrated.version : version) < 9) {
    migrated = migrateV8ToV9(migrated as AppSettings)
  }

  return {
    theme: migrated.theme ?? DEFAULT_SETTINGS.theme,
    syncSettings: migrated.syncSettings ?? DEFAULT_SETTINGS.syncSettings,
    defaultPaymentMethod: (migrated as AppSettings).defaultPaymentMethod,
    defaultCurrency:
      (migrated as AppSettings).defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
    language: (migrated as AppSettings).language ?? DEFAULT_SETTINGS.language,
    enableMathExpressions:
      migrated.enableMathExpressions ?? DEFAULT_SETTINGS.enableMathExpressions,
    useMlOnlyForSmsImports:
      migrated.useMlOnlyForSmsImports ?? DEFAULT_SETTINGS.useMlOnlyForSmsImports,
    backgroundSmsImportEnabled:
      migrated.backgroundSmsImportEnabled ?? DEFAULT_SETTINGS.backgroundSmsImportEnabled,
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

/**
 * Migrate settings from version 2 to version 3
 * Moves auto-sync settings from separate storage keys to AppSettings
 */
async function migrateV2ToV3(settings: AppSettings): Promise<AppSettings> {
  // Load old auto-sync settings from secure storage
  const oldEnabled = await secureStorage.getItem(OLD_AUTO_SYNC_ENABLED_KEY)
  const oldTiming = await secureStorage.getItem(OLD_AUTO_SYNC_TIMING_KEY)

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
    await secureStorage.deleteItem(OLD_AUTO_SYNC_ENABLED_KEY)
    await secureStorage.deleteItem(OLD_AUTO_SYNC_TIMING_KEY)
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
 * Migrate settings from version 5 to version 6
 * Adds language field, importing from "user-language" if available
 */
async function migrateV5ToV6(settings: AppSettings): Promise<AppSettings> {
  let language = "system"
  try {
    const saved = await getItem("user-language")
    if (saved) {
      language = saved
    }
  } catch (e) {
    console.warn("Failed to migrate language setting:", e)
  }

  return {
    ...settings,
    language,
    version: 6,
  }
}

/**
 * Migrate settings from version 6 to version 7
 * Adds math-expression toggle for amount entry
 */
function migrateV6ToV7(settings: AppSettings): AppSettings {
  return {
    ...settings,
    enableMathExpressions: settings.enableMathExpressions ?? true,
    version: 7,
  }
}

/**
 * Migrate settings from version 7 to version 8
 * Adds the SMS-import ML-only feature flag
 */
function migrateV7ToV8(settings: AppSettings): AppSettings {
  return {
    ...settings,
    useMlOnlyForSmsImports: settings.useMlOnlyForSmsImports ?? false,
    version: 8,
  }
}

/**
 * Migrate settings from version 8 to version 9
 * Adds the background SMS import toggle
 */
function migrateV8ToV9(settings: AppSettings): AppSettings {
  return {
    ...settings,
    backgroundSmsImportEnabled: settings.backgroundSmsImportEnabled ?? false,
    version: 9,
  }
}

/**
 * Synchronous fast-path load for the initial app theme.
 * Uses MMKV's sync API so the persisted theme is available before the first
 * React paint, eliminating the system-theme flash when the user has forced
 * light/dark opposite to the OS.
 * Falls back to null if nothing is stored or parsing fails (caller should use
 * DEFAULT_SETTINGS and await the async load).
 * Only pure hydration (hydrateSettingsFromJson) is applied — async migrations
 * (v2->v3, v5->v6 language import) are still handled by loadSettings().
 */
export function loadSettingsSync(): AppSettings | null {
  try {
    const stored = getItemSync(SETTINGS_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as AppSettings
    // Don't run async migrations here; hydrate covers the common case.
    // If the stored version is very old (e.g. <3) the async load will
    // correct it on the next tick, but the splash gate will keep the splash
    // visible so no flash is shown.
    return hydrateSettingsFromJson(parsed)
  } catch {
    return null
  }
}

/**
 * Load settings from AsyncStorage
 * Returns DEFAULT_SETTINGS if not found or on error
 * Performs migration from older versions if needed
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = await getItem(SETTINGS_KEY)
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

      // Migrate from v5 to v6 (add language)
      if (parsed.version < 6) {
        parsed = await migrateV5ToV6(parsed)
        await saveSettings(parsed)
      }

      // Migrate from v6 to v7 (add math entry toggle)
      if (parsed.version < 7) {
        parsed = migrateV6ToV7(parsed)
        await saveSettings(parsed)
      }

      // Migrate from v7 to v8 (add ML-only SMS import toggle)
      if (parsed.version < 8) {
        parsed = migrateV7ToV8(parsed)
        await saveSettings(parsed)
      }

      // Migrate from v8 to v9 (add background SMS import toggle)
      if (parsed.version < 9) {
        parsed = migrateV8ToV9(parsed)
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
    await setItem(SETTINGS_KEY, JSON.stringify(settingsToSave))
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
    await setItem(SETTINGS_CHANGED_KEY, "true")
  } catch (error) {
    console.warn("Failed to mark settings changed:", error)
  }
}

/**
 * Clear the settings changed flag (after successful sync)
 */
export async function clearSettingsChanged(): Promise<void> {
  try {
    await removeItem(SETTINGS_CHANGED_KEY)
  } catch (error) {
    console.warn("Failed to clear settings changed flag:", error)
  }
}

/**
 * Check if settings have been changed since last sync
 */
export async function hasSettingsChanged(): Promise<boolean> {
  try {
    const value = await getItem(SETTINGS_CHANGED_KEY)
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
    return await getItem(SETTINGS_HASH_KEY)
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
    await setItem(SETTINGS_HASH_KEY, hash)
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
    enableMathExpressions: settings.enableMathExpressions,
    backgroundSmsImportEnabled: settings.backgroundSmsImportEnabled,
    language: settings.language,
    paymentInstruments: sortedInstruments,
    syncSettings: settings.syncSettings,
    theme: settings.theme,
    useMlOnlyForSmsImports: settings.useMlOnlyForSmsImports,
    version: settings.version,
    // Note: updatedAt is intentionally excluded from hash
    // so that timestamp changes alone don't trigger re-sync
  })
  return computeContentHash(stableJson)
}
