/**
 * SMS Import Settings selectors backed by AppSettings.
 */

import { SMSImportSettings } from "../../types/sms-import"
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../settings-manager"

/**
 * Load SMS import settings from app settings storage.
 */
export async function loadSMSImportSettings(): Promise<SMSImportSettings> {
  const settings = await loadSettings()
  return {
    ...DEFAULT_SETTINGS.smsImportSettings,
    ...settings.smsImportSettings,
  }
}

/**
 * Save SMS import settings through app settings storage.
 */
export async function saveSMSImportSettings(settings: SMSImportSettings): Promise<void> {
  const current = await loadSettings()
  await saveSettings({
    ...current,
    smsImportSettings: {
      ...DEFAULT_SETTINGS.smsImportSettings,
      ...settings,
    },
  })
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
  await saveSMSImportSettings({ ...DEFAULT_SETTINGS.smsImportSettings })
}
