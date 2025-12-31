import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useColorScheme } from "react-native"
import {
  AppSettings,
  ThemePreference,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  markSettingsChanged,
  clearSettingsChanged,
  hasSettingsChanged,
} from "../services/settings-manager"
import { PaymentMethodType } from "../types/expense"

/**
 * Settings context value interface
 * Provides settings state and actions for managing app settings
 */
export interface SettingsContextValue {
  settings: AppSettings
  isLoading: boolean
  effectiveTheme: "light" | "dark" // Resolved theme (system -> actual)
  hasUnsyncedChanges: boolean
  defaultPaymentMethod?: PaymentMethodType // Convenience accessor

  // Actions
  setTheme: (theme: ThemePreference) => Promise<void>
  setSyncSettings: (enabled: boolean) => Promise<void>
  setDefaultPaymentMethod: (paymentMethod: PaymentMethodType | undefined) => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  replaceSettings: (settings: AppSettings) => Promise<void>
  clearSettingsChangeFlag: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

/**
 * Resolves the effective theme based on preference and system color scheme
 */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemColorScheme: "light" | "dark" | null | undefined
): "light" | "dark" {
  if (preference === "system") {
    // Default to light if system color scheme is not available
    return systemColorScheme === "dark" ? "dark" : "light"
  }
  return preference
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false)

  // Get system color scheme
  const systemColorScheme = useColorScheme()

  // Resolve effective theme based on preference and system
  const effectiveTheme = resolveEffectiveTheme(settings.theme, systemColorScheme)

  // Load settings on mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const loadedSettings = await loadSettings()
        setSettings(loadedSettings)

        // Check if there are unsynced changes
        const changed = await hasSettingsChanged()
        setHasUnsyncedChanges(changed)
      } catch (error) {
        console.warn("Failed to initialize settings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeSettings()
  }, [])

  /**
   * Set theme preference with immediate persistence
   */
  const setTheme = useCallback(
    async (theme: ThemePreference): Promise<void> => {
      const updatedSettings: AppSettings = {
        ...settings,
        theme,
      }

      // Update state immediately for responsive UI
      setSettings(updatedSettings)

      // Persist to storage
      await saveSettings(updatedSettings)

      // Mark as changed for sync tracking
      await markSettingsChanged()
      setHasUnsyncedChanges(true)
    },
    [settings]
  )

  /**
   * Set sync settings preference
   */
  const setSyncSettings = useCallback(
    async (enabled: boolean): Promise<void> => {
      const updatedSettings: AppSettings = {
        ...settings,
        syncSettings: enabled,
      }

      // Update state immediately
      setSettings(updatedSettings)

      // Persist to storage
      await saveSettings(updatedSettings)

      // Mark as changed for sync tracking
      await markSettingsChanged()
      setHasUnsyncedChanges(true)
    },
    [settings]
  )

  /**
   * Set default payment method preference
   */
  const setDefaultPaymentMethod = useCallback(
    async (paymentMethod: PaymentMethodType | undefined): Promise<void> => {
      const updatedSettings: AppSettings = {
        ...settings,
        defaultPaymentMethod: paymentMethod,
      }

      // Update state immediately
      setSettings(updatedSettings)

      // Persist to storage
      await saveSettings(updatedSettings)

      // Mark as changed for sync tracking
      await markSettingsChanged()
      setHasUnsyncedChanges(true)
    },
    [settings]
  )

  /**
   * Update multiple settings at once
   */
  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>): Promise<void> => {
      const updatedSettings: AppSettings = {
        ...settings,
        ...updates,
      }

      // Update state immediately
      setSettings(updatedSettings)

      // Persist to storage
      await saveSettings(updatedSettings)

      // Mark as changed for sync tracking
      await markSettingsChanged()
      setHasUnsyncedChanges(true)
    },
    [settings]
  )

  /**
   * Replace all settings (used when downloading from sync)
   */
  const replaceSettings = useCallback(async (newSettings: AppSettings): Promise<void> => {
    // Update state immediately
    setSettings(newSettings)

    // Persist to storage (without updating timestamp since it comes from remote)
    await saveSettings(newSettings)

    // Clear change flag since we just synced
    await clearSettingsChanged()
    setHasUnsyncedChanges(false)
  }, [])

  /**
   * Clear the settings change flag (after successful sync)
   */
  const clearSettingsChangeFlag = useCallback(async (): Promise<void> => {
    await clearSettingsChanged()
    setHasUnsyncedChanges(false)
  }, [])

  const value: SettingsContextValue = {
    settings,
    isLoading,
    effectiveTheme,
    hasUnsyncedChanges,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    setTheme,
    setSyncSettings,
    setDefaultPaymentMethod,
    updateSettings,
    replaceSettings,
    clearSettingsChangeFlag,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

/**
 * Hook to access settings context
 */
export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}

// Re-export types for convenience
export type { AppSettings, ThemePreference }
