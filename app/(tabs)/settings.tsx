import { useState, useCallback, useMemo } from "react"
import { YStack, XStack, Text, Button, Label } from "tamagui"
import { Alert, Linking, ViewStyle, Platform, Pressable } from "react-native"
import { ChevronDown, ChevronUp } from "@tamagui/lucide-icons"
import { PaymentMethodType } from "../../types/expense"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useCategories,
} from "../../stores/hooks"
import {
  useSyncMachine,
  TrueConflict,
  ConflictResolution,
} from "../../hooks/use-sync-machine"
import { useUpdateCheck } from "../../hooks/use-update-check"
import { testConnection, SyncConfig, syncDown } from "../../services/sync-manager"
import { UpdateInfo } from "../../services/update-checker"
import { APP_CONFIG } from "../../constants/app-config"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { ThemeSelector } from "../../components/ui/ThemeSelector"
import { SettingsSection } from "../../components/ui/SettingsSection"
import { DefaultPaymentMethodSelector } from "../../components/ui/DefaultPaymentMethodSelector"
import { CategorySection } from "../../components/ui/CategorySection"
import { CategoryFormModal } from "../../components/ui/CategoryFormModal"
import { GitHubConfigSection } from "../../components/ui/settings/GitHubConfigSection"
import { AutoSyncSection } from "../../components/ui/settings/AutoSyncSection"
import { AppInfoSection } from "../../components/ui/settings/AppInfoSection"
import { PaymentInstrumentsSection } from "../../components/ui/settings/PaymentInstrumentsSection"
import { Category } from "../../types/category"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  container: {
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,
  syncButtonsContainer: {
    marginTop: 8,
  } as ViewStyle,
  collapsibleHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  } as ViewStyle,
}

export default function SettingsScreen() {
  const {
    state,
    replaceAllExpenses,
    clearPendingChangesAfterSync,
    reassignExpensesToOther,
  } = useExpenses()
  const { addNotification } = useNotifications()
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    replaceCategories,
  } = useCategories()

  // XState sync machine for the main sync flow
  const syncMachine = useSyncMachine()
  const isSyncing = syncMachine.isSyncing

  // Update check hook for manual update checks from settings
  const {
    updateAvailable,
    latestVersion,
    checkForUpdates: manualCheckForUpdates,
    handleUpdate: openUpdateUrl,
  } = useUpdateCheck()

  const {
    settings,
    hasUnsyncedChanges: hasUnsyncedSettingsChanges,
    syncConfig,
    setTheme,
    setSyncSettings,
    setDefaultPaymentMethod,
    setAutoSyncEnabled,
    setAutoSyncTiming,
    replaceSettings,
    clearSettingsChangeFlag,
    saveSyncConfig,
    clearSyncConfig,
  } = useSettings()

  // GitHub config state
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )

  // Derive isConfigured from syncConfig !== null
  const isConfigured = syncConfig !== null

  // Update check state - use hook's state for updateInfo
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  // Derive updateInfo from hook state for AppInfoSection compatibility
  const updateInfo: UpdateInfo | null = useMemo(() => {
    if (latestVersion) {
      return {
        hasUpdate: updateAvailable,
        currentVersion: APP_CONFIG.version,
        latestVersion,
      }
    }
    return null
  }, [updateAvailable, latestVersion])

  // Category form modal state
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined)

  // UI state
  const [defaultPaymentMethodExpanded, setDefaultPaymentMethodExpanded] = useState(false)

  const defaultPaymentMethodLabel = useMemo(() => {
    const value = settings.defaultPaymentMethod
    if (!value) return "None"
    const match = PAYMENT_METHODS.find((m) => m.value === value)
    return match?.label ?? value
  }, [settings.defaultPaymentMethod])

  // GitHub config handlers
  const handleSaveConfig = useCallback(
    async (config: SyncConfig) => {
      // Check if this is first-time configuration (no previous config existed)
      const isFirstTimeSetup = syncConfig === null

      saveSyncConfig(config)
      addNotification("Sync configuration saved", "success")

      // Only prompt to download if this is first-time setup AND no local expenses
      if (isFirstTimeSetup && state.expenses.length === 0) {
        Alert.alert(
          "Download Existing Data?",
          "Would you like to download your expenses from GitHub now?",
          [
            { text: "Not Now", style: "cancel" },
            {
              text: "Download",
              onPress: async () => {
                try {
                  // In restore flows, always attempt to download settings as well.
                  // The downloaded settings may include categories/payment instruments.
                  const result = await syncDown(7, true)
                  if (result.success && result.expenses) {
                    replaceAllExpenses(result.expenses)
                    addNotification(
                      `Downloaded ${result.expenses.length} expenses`,
                      "success"
                    )

                    if (result.settings) {
                      replaceSettings(result.settings)
                      addNotification("Settings applied from GitHub", "success")
                    }

                    if (!settings.autoSyncEnabled) {
                      setAutoSyncEnabled(true)
                      addNotification("Auto-sync enabled", "info")
                    }
                  } else {
                    addNotification(result.error || result.message, "error")
                  }
                } catch (error) {
                  addNotification(String(error), "error")
                }
              },
            },
          ]
        )
      }
    },
    [
      syncConfig,
      state.expenses.length,
      settings.autoSyncEnabled,
      saveSyncConfig,
      setAutoSyncEnabled,
      replaceAllExpenses,
      replaceSettings,
      addNotification,
    ]
  )

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true)
    setConnectionStatus("idle")

    const result = await testConnection()

    setIsTesting(false)
    if (result.success) {
      setConnectionStatus("success")
      addNotification(result.message, "success")
    } else {
      if (result.shouldSignOut) {
        clearSyncConfig()
        setConnectionStatus("idle")
      } else {
        setConnectionStatus("error")
      }

      addNotification(result.error || result.message, "error")
    }
  }, [addNotification, clearSyncConfig])

  const handleClearConfig = useCallback(() => {
    Alert.alert("Confirm Clear", "Remove sync configuration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearSyncConfig()
          setConnectionStatus("idle")
          addNotification("Configuration cleared", "success")
        },
      },
    ])
  }, [clearSyncConfig, addNotification])

  const handleConnectionStatusChange = useCallback(
    (status: "idle" | "success" | "error") => {
      setConnectionStatus(status)
    },
    []
  )

  const handleNotification = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      addNotification(message, type)
    },
    [addNotification]
  )

  // App info handlers - use hook's checkForUpdates for manual checks
  // This bypasses dismissal so users can always check for updates from settings
  const handleCheckForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true)
    try {
      await manualCheckForUpdates()
    } finally {
      setIsCheckingUpdate(false)
    }
  }, [manualCheckForUpdates])

  // Use hook's handleUpdate for opening the release page
  // This correctly handles Play Store vs GitHub based on install source
  const handleOpenRelease = useCallback(async () => {
    await openUpdateUrl()
  }, [openUpdateUrl])

  const handleOpenGitHub = useCallback(() => {
    Linking.openURL(APP_CONFIG.github.url)
  }, [])

  const handleReportIssue = useCallback(() => {
    Linking.openURL(`${APP_CONFIG.github.url}/issues/new/choose`)
  }, [])

  // Theme and settings handlers
  const handleThemeChange = useCallback(
    (theme: "light" | "dark" | "system") => {
      setTheme(theme)
    },
    [setTheme]
  )

  const handleSyncSettingsToggle = useCallback(
    (enabled: boolean) => {
      setSyncSettings(enabled)
    },
    [setSyncSettings]
  )

  const handleDefaultPaymentMethodChange = useCallback(
    (paymentMethod: PaymentMethodType | undefined) => {
      setDefaultPaymentMethod(paymentMethod)
    },
    [setDefaultPaymentMethod]
  )

  // Category CRUD handlers
  const handleAddCategory = useCallback(() => {
    setEditingCategory(undefined)
    setCategoryFormOpen(true)
  }, [])

  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category)
    setCategoryFormOpen(true)
  }, [])

  const handleCategoryFormClose = useCallback(() => {
    setCategoryFormOpen(false)
    setEditingCategory(undefined)
  }, [])

  const handleCategorySave = useCallback(
    (categoryData: Omit<Category, "order" | "updatedAt">) => {
      if (editingCategory) {
        // Edit mode - update existing category
        updateCategory(editingCategory.label, {
          label: categoryData.label,
          icon: categoryData.icon,
          color: categoryData.color,
          isDefault: categoryData.isDefault,
        })
        addNotification(`Category "${categoryData.label}" updated`, "success")
      } else {
        // Add mode - create new category
        addCategory(categoryData)
        addNotification(`Category "${categoryData.label}" added`, "success")
      }
    },
    [editingCategory, updateCategory, addCategory, addNotification]
  )

  const handleCategoryReorder = useCallback(
    (labels: string[]) => {
      reorderCategories(labels)
    },
    [reorderCategories]
  )

  // Get existing category labels for uniqueness validation
  const existingCategoryLabels = useMemo(
    () => categories.map((c) => c.label),
    [categories]
  )

  // Get expense count for a category (for delete confirmation)
  const getExpenseCountForCategory = useCallback(
    (label: string): number => {
      return state.expenses.filter((e) => e.category === label && !e.deletedAt).length
    },
    [state.expenses]
  )

  // Handle category deletion with confirmation and expense reassignment
  const handleCategoryDelete = useCallback(
    (label: string) => {
      // Prevent deletion of "Other" category
      if (label === "Other") {
        addNotification('The "Other" category cannot be deleted', "error")
        return
      }

      const expenseCount = getExpenseCountForCategory(label)
      const message =
        expenseCount > 0
          ? `Delete "${label}"? ${expenseCount} expense${expenseCount === 1 ? "" : "s"} will be reassigned to "Other".`
          : `Delete "${label}"?`

      Alert.alert("Delete Category", message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Reassign expenses to "Other" before deleting the category
            if (expenseCount > 0) {
              reassignExpensesToOther(label)
            }
            deleteCategory(label)
            addNotification(`Category "${label}" deleted`, "success")
          },
        },
      ])
    },
    [getExpenseCountForCategory, reassignExpensesToOther, deleteCategory, addNotification]
  )

  // Calculate pending count for display on sync button
  const pendingCount = useMemo(() => {
    const expenseChanges =
      state.pendingChanges.added +
      state.pendingChanges.edited +
      state.pendingChanges.deleted
    const settingsChanges = settings.syncSettings && hasUnsyncedSettingsChanges ? 1 : 0
    return expenseChanges + settingsChanges
  }, [state.pendingChanges, settings.syncSettings, hasUnsyncedSettingsChanges])

  // Sync button text with pending count
  const syncButtonText = useMemo(() => {
    if (isSyncing) return "Syncing..."
    if (pendingCount > 0) return `Sync Now (${pendingCount})`
    return "Sync Now"
  }, [isSyncing, pendingCount])

  /**
   * Show conflict resolution dialog for true conflicts
   * Returns user's resolution choices or undefined if cancelled
   */
  const showConflictDialog = useCallback(
    (conflicts: TrueConflict[]): Promise<ConflictResolution[] | undefined> => {
      return new Promise((resolve) => {
        const conflictCount = conflicts.length
        const conflictSummary = conflicts
          .slice(0, 3)
          .map((c) => {
            const localNote = c.localVersion.note || "Unnamed"
            const remoteNote = c.remoteVersion.note || "Unnamed"
            const localAmount = `${c.localVersion.amount}`
            const remoteAmount = `${c.remoteVersion.amount}`

            return `• Local: ${localNote} (${localAmount})\n  Remote: ${remoteNote} (${remoteAmount})`
          })
          .join("\n\n")
        const moreText = conflictCount > 3 ? `\n\n...and ${conflictCount - 3} more` : ""

        Alert.alert(
          `${conflictCount} Conflict${conflictCount > 1 ? "s" : ""} Found`,
          `Both local and remote have changes to the same expense${conflictCount > 1 ? "s" : ""}:\n\n${conflictSummary}${moreText}\n\nWhich version would you like to keep?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => resolve(undefined),
            },
            {
              text: "Keep Local",
              onPress: () => {
                const resolutions: ConflictResolution[] = conflicts.map((c) => ({
                  expenseId: c.expenseId,
                  choice: "local" as const,
                }))
                resolve(resolutions)
              },
            },
            {
              text: "Keep Remote",
              onPress: () => {
                const resolutions: ConflictResolution[] = conflicts.map((c) => ({
                  expenseId: c.expenseId,
                  choice: "remote" as const,
                }))
                resolve(resolutions)
              },
            },
          ]
        )
      })
    },
    []
  )

  // Handle sync using XState machine with callbacks
  const handleSync = useCallback(() => {
    syncMachine.sync({
      localExpenses: state.expenses,
      settings: settings.syncSettings ? settings : undefined,
      syncSettingsEnabled: settings.syncSettings,
      callbacks: {
        onAuthError: ({ shouldSignOut }) => {
          if (shouldSignOut) {
            clearSyncConfig()
          }
        },
        onConflict: async (conflicts: TrueConflict[]) => {
          const resolutions = await showConflictDialog(conflicts)
          if (resolutions) {
            syncMachine.resolveConflicts(resolutions)
          } else {
            syncMachine.cancel()
          }
        },
        onSuccess: (result) => {
          const messageParts: string[] = []

          if (result.mergeResult) {
            const {
              addedFromRemote,
              updatedFromRemote,
              addedFromLocal,
              updatedFromLocal,
              autoResolved,
            } = result.mergeResult
            if (addedFromRemote.length > 0) {
              messageParts.push(`${addedFromRemote.length} new from remote`)
            }
            if (updatedFromRemote.length > 0) {
              messageParts.push(`${updatedFromRemote.length} updated from remote`)
            }
            if (addedFromLocal.length > 0) {
              messageParts.push(`${addedFromLocal.length} new from local`)
            }
            if (updatedFromLocal.length > 0) {
              messageParts.push(`${updatedFromLocal.length} updated from local`)
            }
            if (autoResolved.length > 0) {
              messageParts.push(`${autoResolved.length} auto-resolved`)
            }
          }

          if (result.syncResult) {
            if (result.syncResult.filesUploaded > 0) {
              messageParts.push(`${result.syncResult.filesUploaded} file(s) uploaded`)
            }
            if (result.syncResult.filesSkipped > 0) {
              messageParts.push(`${result.syncResult.filesSkipped} unchanged`)
            }
          }

          const message =
            messageParts.length > 0
              ? `Synced: ${messageParts.join(", ")}`
              : "Sync complete"

          addNotification(message, "success")
          clearPendingChangesAfterSync()
          if (settings.syncSettings) {
            clearSettingsChangeFlag()
          }

          if (result.mergeResult && result.mergeResult.merged.length > 0) {
            replaceAllExpenses(result.mergeResult.merged)
          }

          if (settings.syncSettings && result.syncResult?.mergedSettings) {
            replaceSettings(result.syncResult.mergedSettings)
          } else if (result.syncResult?.mergedCategories) {
            // Backward-compatible fallback for older sync results
            replaceCategories(result.syncResult.mergedCategories)
          }
        },
        onInSync: () => {
          addNotification("Already in sync - no changes needed", "success")
        },
        onError: (error) => {
          addNotification(error, "error")
        },
      },
    })
  }, [
    syncMachine,
    state.expenses,
    settings,
    showConflictDialog,
    addNotification,
    clearSyncConfig,
    clearPendingChangesAfterSync,
    clearSettingsChangeFlag,
    replaceAllExpenses,
    replaceSettings,
    replaceCategories,
  ])

  return (
    <ScreenContainer>
      <YStack gap="$4" style={layoutStyles.container}>
        {/* DEFAULT PAYMENT METHOD Section */}
        <SettingsSection title="DEFAULT PAYMENT METHOD">
          <YStack gap="$2">
            <Pressable
              onPress={() => setDefaultPaymentMethodExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: defaultPaymentMethodExpanded }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <XStack flex={1} style={layoutStyles.collapsibleHeader}>
                <YStack gap="$1" flex={1} pointerEvents="none">
                  <Label color="$color" opacity={0.8}>
                    Default
                  </Label>
                  <Text color="$color" opacity={0.6} fontSize="$3">
                    {defaultPaymentMethodLabel}
                  </Text>
                </YStack>
                {defaultPaymentMethodExpanded ? (
                  <ChevronUp size={20} color="$color" opacity={0.6} />
                ) : (
                  <ChevronDown size={20} color="$color" opacity={0.6} />
                )}
              </XStack>
            </Pressable>

            {defaultPaymentMethodExpanded && (
              <YStack gap="$2">
                <Text color="$color" opacity={0.7} fontSize="$3">
                  Pre-select this payment method when adding new expenses.
                </Text>
                <DefaultPaymentMethodSelector
                  value={settings.defaultPaymentMethod}
                  onChange={handleDefaultPaymentMethodChange}
                />
              </YStack>
            )}
          </YStack>
        </SettingsSection>

        {/* PAYMENT INSTRUMENTS Section */}
        <SettingsSection title="PAYMENT INSTRUMENTS">
          <PaymentInstrumentsSection />
        </SettingsSection>

        {/* CATEGORIES Section */}
        <CategorySection
          categories={categories}
          onAdd={handleAddCategory}
          onEdit={handleEditCategory}
          onDelete={handleCategoryDelete}
          onReorder={handleCategoryReorder}
          getExpenseCount={getExpenseCountForCategory}
        />

        {/* Category Form Modal */}
        <CategoryFormModal
          open={categoryFormOpen}
          onClose={handleCategoryFormClose}
          category={editingCategory}
          existingLabels={existingCategoryLabels}
          onSave={handleCategorySave}
        />

        {/* GITHUB SYNC Section */}
        <SettingsSection title="GITHUB SYNC">
          <Text color="$color" opacity={0.7} fontSize="$3">
            {Platform.OS === "web"
              ? "Sync your expenses to a GitHub repository using a Personal Access Token."
              : "Sign in with GitHub to sync your expenses to a personal repository you own (organization repos aren’t supported)."}
          </Text>

          {/* GitHub Configuration */}
          <GitHubConfigSection
            syncConfig={syncConfig}
            onSaveConfig={handleSaveConfig}
            onTestConnection={handleTestConnection}
            onClearConfig={handleClearConfig}
            isTesting={isTesting}
            connectionStatus={connectionStatus}
            onConnectionStatusChange={handleConnectionStatusChange}
            onNotification={handleNotification}
          />

          {/* Sync Button and Auto-Sync Options - only shown when configured */}
          {isConfigured && (
            <YStack gap="$4" style={layoutStyles.syncButtonsContainer}>
              <Button size="$4" onPress={handleSync} disabled={isSyncing} themeInverse>
                {syncButtonText}
              </Button>

              {/* Auto-Sync Section */}
              <AutoSyncSection
                autoSyncEnabled={settings.autoSyncEnabled}
                autoSyncTiming={settings.autoSyncTiming}
                syncSettings={settings.syncSettings}
                onAutoSyncEnabledChange={setAutoSyncEnabled}
                onAutoSyncTimingChange={setAutoSyncTiming}
                onSyncSettingsChange={handleSyncSettingsToggle}
              />
            </YStack>
          )}
        </SettingsSection>

        {/* APPEARANCE Section */}
        <SettingsSection title="APPEARANCE">
          <YStack gap="$2">
            <Label>Theme</Label>
            <ThemeSelector value={settings.theme} onChange={handleThemeChange} />
          </YStack>
        </SettingsSection>

        {/* APP INFORMATION Section */}
        <SettingsSection title="APP INFORMATION">
          <AppInfoSection
            currentVersion={APP_CONFIG.version}
            updateInfo={updateInfo}
            isCheckingUpdate={isCheckingUpdate}
            onCheckForUpdates={handleCheckForUpdates}
            onOpenRelease={handleOpenRelease}
            onOpenGitHub={handleOpenGitHub}
            onReportIssue={handleReportIssue}
          />
        </SettingsSection>
      </YStack>
    </ScreenContainer>
  )
}
