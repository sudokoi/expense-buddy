import { createStore } from "@xstate/store"
import { Appearance } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  AppSettings,
  ThemePreference,
  AutoSyncTiming,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  markSettingsChanged,
  clearSettingsChanged,
  computeSettingsHash,
  getSettingsHash,
  saveSettingsHash,
} from "../services/settings-manager"
import { PaymentMethodType } from "../types/expense"
import {
  SyncConfig,
  saveSyncConfig as saveSyncConfigToStorage,
  clearSyncConfig as clearSyncConfigFromStorage,
  loadSyncConfig as loadSyncConfigFromStorage,
} from "../services/sync-manager"
import { Category } from "../types/category"
import { getRandomCategoryColor } from "../constants/category-colors"
import { computeSettingsSyncState, SettingsSyncState } from "./helpers"
import { changeLanguage } from "../i18n"

// Re-export SettingsSyncState for backward compatibility
export type { SettingsSyncState }

/**
 * Factory function to create setting updater actions.
 * Eliminates repetitive boilerplate for simple settings updates.
 */
function createSettingUpdater<K extends keyof AppSettings>(key: K) {
  return (
    context: {
      settings: AppSettings
      isLoading: boolean
      settingsSyncState: SettingsSyncState
      syncedSettingsHash: string | null
      systemColorScheme: "light" | "dark"
      syncConfig: SyncConfig | null
    },
    event: { [P in K]: AppSettings[K] },
    enqueue: { effect: (fn: () => Promise<void>) => void }
  ) => {
    const newSettings = { ...context.settings, [key]: event[key] }
    const newSyncState = computeSettingsSyncState(newSettings, context.syncedSettingsHash)

    enqueue.effect(async () => {
      await saveSettings(newSettings)
      if (newSyncState === "modified") {
        await markSettingsChanged()
      } else {
        await clearSettingsChanged()
      }
    })

    return {
      ...context,
      settings: newSettings,
      settingsSyncState: newSyncState,
    }
  }
}

export const settingsStore = createStore({
  context: {
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    settingsSyncState: "synced" as SettingsSyncState,
    syncedSettingsHash: null as string | null,
    systemColorScheme: (Appearance.getColorScheme() ?? "light") as "light" | "dark",
    syncConfig: null as SyncConfig | null,
  },

  on: {
    loadSettings: (
      context,
      event: {
        settings: AppSettings
        settingsSyncState: SettingsSyncState
        syncedSettingsHash: string | null
        syncConfig?: SyncConfig | null
      },
      enqueue
    ) => {
      // Sync i18n language when settings are loaded
      enqueue.effect(async () => {
        if (event.settings.language) {
          await changeLanguage(event.settings.language)
        }
      })

      return {
        ...context,
        settings: event.settings,
        settingsSyncState: event.settingsSyncState,
        syncedSettingsHash: event.syncedSettingsHash,
        isLoading: false,
        syncConfig: event.syncConfig ?? context.syncConfig,
      }
    },

    setSystemColorScheme: (context, event: { scheme: "light" | "dark" }) => ({
      ...context,
      systemColorScheme: event.scheme,
    }),

    setTheme: (context, event: { theme: ThemePreference }, enqueue) => {
      const newSettings = { ...context.settings, theme: event.theme }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    setSyncSettings: createSettingUpdater("syncSettings"),

    setDefaultPaymentMethod: createSettingUpdater("defaultPaymentMethod"),

    setDefaultCurrency: createSettingUpdater("defaultCurrency"),

    setLanguage: createSettingUpdater("language"),

    setAutoSyncEnabled: createSettingUpdater("autoSyncEnabled"),

    setAutoSyncTiming: createSettingUpdater("autoSyncTiming"),

    updateSettings: (context, event: { updates: Partial<AppSettings> }, enqueue) => {
      const newSettings = { ...context.settings, ...event.updates }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    replaceSettings: (
      context,
      event: { settings: AppSettings; syncedSettingsHash?: string },
      enqueue
    ) => {
      const newHash = event.syncedSettingsHash ?? computeSettingsHash(event.settings)

      enqueue.effect(async () => {
        await saveSettings(event.settings)
        await saveSettingsHash(newHash)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settings: event.settings,
        settingsSyncState: "synced" as SettingsSyncState,
        syncedSettingsHash: newHash,
      }
    },

    clearSettingsChangeFlag: (context, _event, enqueue) => {
      const currentHash = computeSettingsHash(context.settings)

      enqueue.effect(async () => {
        await saveSettingsHash(currentHash)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settingsSyncState: "synced" as SettingsSyncState,
        syncedSettingsHash: currentHash,
      }
    },

    // Called after successful sync to update the synced hash
    syncSettingsSuccess: (context, event: { settingsHash: string }, enqueue) => {
      enqueue.effect(async () => {
        await saveSettingsHash(event.settingsHash)
        await clearSettingsChanged()
      })

      return {
        ...context,
        settingsSyncState: "synced" as SettingsSyncState,
        syncedSettingsHash: event.settingsHash,
      }
    },

    // Sync config management actions
    loadSyncConfig: (context, event: { config: SyncConfig | null }) => ({
      ...context,
      syncConfig: event.config,
    }),

    saveSyncConfig: (context, event: { config: SyncConfig }, enqueue) => {
      enqueue.effect(async () => {
        await saveSyncConfigToStorage(event.config)
      })

      return {
        ...context,
        syncConfig: event.config,
      }
    },

    clearSyncConfig: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearSyncConfigFromStorage()
      })

      return {
        ...context,
        syncConfig: null,
      }
    },

    // Category management actions

    /**
     * Add a new category with auto-assigned order
     * New categories are inserted before "Other" which always stays at the bottom
     */
    addCategory: (
      context,
      event: { category: Omit<Category, "order" | "updatedAt"> },
      enqueue
    ) => {
      const existingColors = context.settings.categories.map((c) => c.color)

      // Find "Other" category to get its order (it should always be last)
      const otherCategory = context.settings.categories.find((c) => c.label === "Other")
      const otherOrder = otherCategory?.order ?? context.settings.categories.length

      // New category gets the order that "Other" currently has
      const newCategory: Category = {
        ...event.category,
        label: event.category.label.trim(),
        icon: event.category.icon.trim(),
        color: event.category.color || getRandomCategoryColor(existingColors),
        order: otherOrder,
        updatedAt: new Date().toISOString(),
      }

      // Update "Other" to have a higher order so it stays at the bottom
      const newCategories = context.settings.categories.map((cat) => {
        if (cat.label === "Other") {
          return {
            ...cat,
            order: otherOrder + 1,
            updatedAt: new Date().toISOString(),
          }
        }
        return cat
      })
      newCategories.push(newCategory)

      const newSettings = { ...context.settings, categories: newCategories }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    /**
     * Update an existing category by label
     */
    updateCategory: (
      context,
      event: { label: string; updates: Partial<Omit<Category, "updatedAt">> },
      enqueue
    ) => {
      const normalizedLabel = event.label.trim()
      const normalizedUpdates: typeof event.updates = {
        ...event.updates,
        ...(event.updates.label ? { label: event.updates.label.trim() } : {}),
        ...(event.updates.icon ? { icon: event.updates.icon.trim() } : {}),
      }

      const newCategories = context.settings.categories.map((cat) => {
        if (cat.label === normalizedLabel) {
          return {
            ...cat,
            ...normalizedUpdates,
            updatedAt: new Date().toISOString(),
          }
        }
        return cat
      })

      const newSettings = { ...context.settings, categories: newCategories }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    /**
     * Delete a category by label
     * Note: "Other" category cannot be deleted (should be checked by caller)
     * When a category is deleted, "Other"'s order is decremented to stay at the bottom
     */
    deleteCategory: (context, event: { label: string }, enqueue) => {
      // Prevent deletion of "Other" category
      if (event.label === "Other") {
        return context
      }

      // Filter out the deleted category and decrement "Other"'s order
      const newCategories = context.settings.categories
        .filter((cat) => cat.label !== event.label)
        .map((cat) => {
          if (cat.label === "Other") {
            return {
              ...cat,
              order: cat.order - 1,
              updatedAt: new Date().toISOString(),
            }
          }
          return cat
        })

      const newSettings = { ...context.settings, categories: newCategories }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    /**
     * Reorder categories by providing an array of labels in the new order
     */
    reorderCategories: (context, event: { labels: string[] }, enqueue) => {
      // Create a map of label to category for quick lookup
      const categoryMap = new Map(
        context.settings.categories.map((cat) => [cat.label, cat])
      )

      // Reorder categories based on the provided labels array
      const newCategories = event.labels
        .map((label, index) => {
          const cat = categoryMap.get(label.trim())
          if (cat) {
            return {
              ...cat,
              order: index,
              updatedAt: new Date().toISOString(),
            }
          }
          return null
        })
        .filter((cat): cat is Category => cat !== null)

      // Add any categories not in the labels array (shouldn't happen, but safety)
      const labelsSet = new Set(event.labels)
      const missingCategories = context.settings.categories
        .filter((cat) => !labelsSet.has(cat.label))
        .map((cat, index) => ({
          ...cat,
          order: newCategories.length + index,
          updatedAt: new Date().toISOString(),
        }))

      const finalCategories = [...newCategories, ...missingCategories]
      const newSettings = { ...context.settings, categories: finalCategories }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },

    /**
     * Replace all categories (used for sync)
     */
    replaceCategories: (context, event: { categories: Category[] }, enqueue) => {
      const sanitizedCategories = event.categories.map((c) => ({
        ...c,
        label: c.label.trim(),
        icon: c.icon.trim(),
      }))

      const newSettings = { ...context.settings, categories: sanitizedCategories }
      const newSyncState = computeSettingsSyncState(
        newSettings,
        context.syncedSettingsHash
      )

      enqueue.effect(async () => {
        await saveSettings(newSettings)
        if (newSyncState === "modified") {
          await markSettingsChanged()
        } else {
          await clearSettingsChanged()
        }
      })

      return {
        ...context,
        settings: newSettings,
        settingsSyncState: newSyncState,
      }
    },
  },
})

// Computed selector for effective theme
type SettingsContext = typeof settingsStore extends {
  getSnapshot: () => { context: infer C }
}
  ? C
  : never

export const selectEffectiveTheme = (context: SettingsContext): "light" | "dark" => {
  if (context.settings.theme === "system") {
    return context.systemColorScheme
  }
  return context.settings.theme
}

/**
 * Selector to derive hasUnsyncedChanges boolean from sync state
 * For backward compatibility with existing code
 */
export const selectHasUnsyncedChanges = (context: SettingsContext): boolean => {
  return context.settingsSyncState === "modified"
}

/**
 * Selector to get categories sorted by order
 */
export const selectCategories = (context: SettingsContext): Category[] => {
  return [...context.settings.categories].sort((a, b) => a.order - b.order)
}

/**
 * Selector to get a category by label (case-insensitive)
 */
export const selectCategoryByLabel = (
  context: SettingsContext,
  label: string
): Category | undefined => {
  const lowerLabel = label.toLowerCase()
  return context.settings.categories.find((cat) => cat.label.toLowerCase() === lowerLabel)
}

// Listen for system color scheme changes
Appearance.addChangeListener(({ colorScheme }) => {
  settingsStore.trigger.setSystemColorScheme({ scheme: colorScheme ?? "light" })
})

// Exported initialization function - call from React component tree
export async function initializeSettingsStore(): Promise<void> {
  try {
    // Load all settings in parallel
    const [settings, syncedSettingsHash, syncConfig] = await Promise.all([
      loadSettings(),
      getSettingsHash(),
      loadSyncConfigFromStorage(),
    ])

    // Compute initial sync state by comparing current settings against synced hash
    const settingsSyncState = computeSettingsSyncState(settings, syncedSettingsHash)

    settingsStore.trigger.loadSettings({
      settings,
      settingsSyncState,
      syncedSettingsHash,
      syncConfig,
    })
  } catch (error) {
    console.warn("Failed to initialize settings store:", error)
    settingsStore.trigger.loadSettings({
      settings: DEFAULT_SETTINGS,
      settingsSyncState: "synced",
      syncedSettingsHash: null,
      syncConfig: null,
    })
  }
}

export type SettingsStore = typeof settingsStore
