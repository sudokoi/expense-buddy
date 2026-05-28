import { useCallback } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import {
  selectEffectiveTheme,
  selectHasUnsyncedChanges,
  setBackgroundSmsImportEnabled as persistBackgroundSmsImportEnabled,
} from "../settings-store"
import {
  ThemePreference,
  AppSettings,
  AutoSyncTiming,
} from "../../services/settings-manager"
import { PaymentMethodType } from "../../types/expense"
import { SyncConfig } from "../../services/sync-manager"
import { requestBackgroundSmsPermissions } from "../../services/background-sms/background-sms-permissions"

export const useSettings = () => {
  const { settingsStore } = useStoreContext()

  const settings = useSelector(settingsStore, (state) => state.context.settings)
  const isLoading = useSelector(settingsStore, (state) => state.context.isLoading)
  const hasUnsyncedChanges = useSelector(settingsStore, (state) =>
    selectHasUnsyncedChanges(state.context)
  )
  const effectiveTheme = useSelector(settingsStore, (state) =>
    selectEffectiveTheme(state.context)
  )
  const syncConfig = useSelector(settingsStore, (state) => state.context.syncConfig)

  const setTheme = useCallback(
    (theme: ThemePreference) => settingsStore.trigger.setTheme({ theme }),
    [settingsStore]
  )

  const setSyncSettings = useCallback(
    (syncSettings: boolean) => settingsStore.trigger.setSyncSettings({ syncSettings }),
    [settingsStore]
  )

  const setDefaultPaymentMethod = useCallback(
    (defaultPaymentMethod: PaymentMethodType | undefined) =>
      settingsStore.trigger.setDefaultPaymentMethod({ defaultPaymentMethod }),
    [settingsStore]
  )

  const setEnableMathExpressions = useCallback(
    (enableMathExpressions: boolean) =>
      settingsStore.trigger.setEnableMathExpressions({ enableMathExpressions }),
    [settingsStore]
  )

  const setBackgroundSmsImportEnabled = useCallback(
    async (backgroundSmsImportEnabled: boolean) => {
      await persistBackgroundSmsImportEnabled(backgroundSmsImportEnabled, settingsStore)
    },
    [settingsStore]
  )

  const setAutoSyncEnabled = useCallback(
    (autoSyncEnabled: boolean) =>
      settingsStore.trigger.setAutoSyncEnabled({ autoSyncEnabled }),
    [settingsStore]
  )

  const setAutoSyncTiming = useCallback(
    (autoSyncTiming: AutoSyncTiming) =>
      settingsStore.trigger.setAutoSyncTiming({ autoSyncTiming }),
    [settingsStore]
  )

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => settingsStore.trigger.updateSettings({ updates }),
    [settingsStore]
  )

  const replaceSettings = useCallback(
    async (newSettings: AppSettings) => {
      let settingsToApply = newSettings
      if (newSettings.backgroundSmsImportEnabled) {
        const result = await requestBackgroundSmsPermissions()
        if (!result.granted) {
          settingsToApply = { ...newSettings, backgroundSmsImportEnabled: false }
        }
      }
      settingsStore.trigger.replaceSettings({ settings: settingsToApply })
    },
    [settingsStore]
  )

  const clearSettingsChangeFlag = useCallback(
    () => settingsStore.trigger.clearSettingsChangeFlag(),
    [settingsStore]
  )

  const saveSyncConfig = useCallback(
    (config: SyncConfig) => settingsStore.trigger.saveSyncConfig({ config }),
    [settingsStore]
  )

  const clearSyncConfig = useCallback(
    () => settingsStore.trigger.clearSyncConfig(),
    [settingsStore]
  )

  const setDefaultCurrency = useCallback(
    (defaultCurrency: string) =>
      settingsStore.trigger.setDefaultCurrency({ defaultCurrency }),
    [settingsStore]
  )

  const setLanguage = useCallback(
    (language: string) => settingsStore.trigger.setLanguage({ language }),
    [settingsStore]
  )

  return {
    settings,
    isLoading,
    effectiveTheme,
    hasUnsyncedChanges,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    enableMathExpressions: settings.enableMathExpressions,
    autoSyncEnabled: settings.autoSyncEnabled,
    autoSyncTiming: settings.autoSyncTiming,
    syncConfig,
    setTheme,
    setSyncSettings,
    setDefaultPaymentMethod,
    setEnableMathExpressions,
    setBackgroundSmsImportEnabled,
    setAutoSyncEnabled,
    setAutoSyncTiming,
    updateSettings,
    replaceSettings,
    clearSettingsChangeFlag,
    saveSyncConfig,
    clearSyncConfig,
    setDefaultCurrency,
    setLanguage,
  }
}

export const useThemeSettings = () => {
  const { settingsStore } = useStoreContext()

  const isLoading = useSelector(settingsStore, (state) => state.context.isLoading)
  const effectiveTheme = useSelector(settingsStore, (state) =>
    selectEffectiveTheme(state.context)
  )

  return { isLoading, effectiveTheme }
}
