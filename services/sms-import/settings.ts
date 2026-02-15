/**
 * SMS Import Settings Service
 *
 * Manages SMS import settings persistence and retrieval
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import { SMSImportSettings } from "../../types/sms-import"
import { STORAGE_KEYS, DEFAULT_SMS_IMPORT_SETTINGS } from "./constants"

/**
 * Load SMS import settings from storage
 */
export async function loadSMSImportSettings(): Promise<SMSImportSettings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.IMPORT_SETTINGS)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SMSImportSettings>
      return {
        enabled: parsed.enabled ?? DEFAULT_SMS_IMPORT_SETTINGS.enabled,
        scanOnLaunch: parsed.scanOnLaunch ?? DEFAULT_SMS_IMPORT_SETTINGS.scanOnLaunch,
        reviewRetentionDays:
          parsed.reviewRetentionDays ?? DEFAULT_SMS_IMPORT_SETTINGS.reviewRetentionDays,
      }
    }
  } catch (error) {
    console.error("Failed to load SMS import settings:", error)
  }

  return { ...DEFAULT_SMS_IMPORT_SETTINGS }
}

/**
 * Save SMS import settings to storage
 */
export async function saveSMSImportSettings(settings: SMSImportSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.IMPORT_SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error("Failed to save SMS import settings:", error)
    throw error
  }
}

/**
 * Update specific SMS import settings fields
 */
export async function updateSMSImportSettings(
  updates: Partial<SMSImportSettings>
): Promise<SMSImportSettings> {
  const current = await loadSMSImportSettings()
  const updated = { ...current, ...updates }
  await saveSMSImportSettings(updated)
  return updated
}

/**
 * Check if SMS import is enabled
 */
export async function isSMSImportEnabled(): Promise<boolean> {
  const settings = await loadSMSImportSettings()
  return settings.enabled
}

/**
 * Reset SMS import settings to defaults
 */
export async function resetSMSImportSettings(): Promise<void> {
  await saveSMSImportSettings({ ...DEFAULT_SMS_IMPORT_SETTINGS })
}
