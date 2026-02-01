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
import { LocalizationSection } from "../../components/ui/settings/LocalizationSection"
import { Category } from "../../types/category"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()

  const { state, replaceAllExpenses, clearDirtyDaysAfterSync, reassignExpensesToOther } =
    useExpenses()
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
    setDefaultCurrency,
    setLanguage,
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
    if (!value) return t("settings.defaultPayment.none")
    const match = PAYMENT_METHODS.find((m) => m.value === value)
    return match?.label ?? value
  }, [settings.defaultPaymentMethod, t])

  // GitHub config handlers
  const handleSaveConfig = useCallback(
    async (config: SyncConfig) => {
      // Check if this is first-time configuration (no previous config existed)
      const isFirstTimeSetup = syncConfig === null

      saveSyncConfig(config)
      addNotification(t("settings.github.successConfig"), "success")

      // Only prompt to download if this is first-time setup AND no local expenses
      if (isFirstTimeSetup && state.expenses.length === 0) {
        Alert.alert(
          t("settings.downloadPrompt.title"),
          t("settings.downloadPrompt.message"),
          [
            { text: t("settings.downloadPrompt.notNow"), style: "cancel" },
            {
              text: t("settings.downloadPrompt.download"),
              onPress: async () => {
                try {
                  // In restore flows, always attempt to download settings as well.
                  // The downloaded settings may include categories/payment instruments.
                  const result = await syncDown(7, true)
                  if (result.success && result.expenses) {
                    replaceAllExpenses(result.expenses)
                    addNotification(
                      t("settings.notifications.downloaded", {
                        count: result.expenses.length,
                      }),
                      "success"
                    )

                    if (result.settings) {
                      replaceSettings(result.settings)
                      addNotification(
                        t("settings.notifications.settingsApplied"),
                        "success"
                      )
                    }

                    if (!settings.autoSyncEnabled) {
                      setAutoSyncEnabled(true)
                      addNotification(t("settings.notifications.autoSyncEnabled"), "info")
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
      t,
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
    Alert.alert(t("settings.clearDialog.title"), t("settings.clearDialog.message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.clearDialog.clear"),
        style: "destructive",
        onPress: () => {
          clearSyncConfig()
          setConnectionStatus("idle")
          addNotification(t("settings.notifications.configCleared"), "success")
        },
      },
    ])
  }, [clearSyncConfig, addNotification, t])

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

  const handleLanguageChange = useCallback(
    (lang: string) => {
      setLanguage(lang)
    },
    [setLanguage]
  )

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      setDefaultCurrency(currency)
    },
    [setDefaultCurrency]
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
        addNotification(
          t("settings.notifications.categoryUpdated", { label: categoryData.label }),
          "success"
        )
      } else {
        // Add mode - create new category
        addCategory(categoryData)
        addNotification(
          t("settings.notifications.categoryAdded", { label: categoryData.label }),
          "success"
        )
      }
    },
    [editingCategory, updateCategory, addCategory, addNotification, t]
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
        addNotification(t("settings.notifications.otherDeleteError"), "error")
        return
      }

      const expenseCount = getExpenseCountForCategory(label)
      const message =
        expenseCount > 0
          ? t("settings.categories.deleteDialog.messageReassign", {
              label,
              count: expenseCount,
            })
          : t("settings.categories.deleteDialog.messageSimple", { label })

      Alert.alert(t("settings.categories.deleteDialog.title"), message, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            // Reassign expenses to "Other" before deleting the category
            if (expenseCount > 0) {
              reassignExpensesToOther(label)
            }
            deleteCategory(label)
            addNotification(
              t("settings.notifications.categoryDeleted", { label }),
              "success"
            )
          },
        },
      ])
    },
    [
      getExpenseCountForCategory,
      reassignExpensesToOther,
      deleteCategory,
      addNotification,
      t,
    ]
  )

  // Calculate pending count for display on sync button
  const pendingCount = useMemo(() => {
    const uniqueDirtyDays = new Set([...state.dirtyDays, ...state.deletedDays])
    const expenseChanges = uniqueDirtyDays.size
    const settingsChanges = settings.syncSettings && hasUnsyncedSettingsChanges ? 1 : 0
    return expenseChanges + settingsChanges
  }, [
    state.dirtyDays,
    state.deletedDays,
    settings.syncSettings,
    hasUnsyncedSettingsChanges,
  ])

  // Sync button text with pending count
  const syncButtonText = useMemo(() => {
    if (isSyncing) return t("settings.autoSync.syncing")
    if (pendingCount > 0) return `${t("settings.autoSync.syncNow")} (${pendingCount})`
    return t("settings.autoSync.syncNow")
  }, [isSyncing, pendingCount, t])

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
          t("settings.conflicts.title", {
            count: conflictCount,
            s: conflictCount > 1 ? "s" : "",
          }),
          t("settings.conflicts.message", {
            s: conflictCount > 1 ? "s" : "",
            summary: `${conflictSummary}${moreText}`,
          }),
          [
            {
              text: t("common.cancel"),
              style: "cancel",
              onPress: () => resolve(undefined),
            },
            {
              text: t("settings.conflicts.keepLocal"),
              onPress: () => {
                const resolutions: ConflictResolution[] = conflicts.map((c) => ({
                  expenseId: c.expenseId,
                  choice: "local" as const,
                }))
                resolve(resolutions)
              },
            },
            {
              text: t("settings.conflicts.keepRemote"),
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
    [t]
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
          const localFilesUpdated = result.syncResult?.localFilesUpdated ?? 0
          const remoteFilesUpdated = result.syncResult?.remoteFilesUpdated ?? 0
          const message = `${t("settings.notifications.syncComplete")} — ${localFilesUpdated} local files updated, ${remoteFilesUpdated} remote files updated`
          addNotification(message, "success")
          clearDirtyDaysAfterSync()
          if (settings.syncSettings) {
            clearSettingsChangeFlag()
          }

          if (result.mergeResult && result.mergeResult.merged.length > 0) {
            replaceAllExpenses(result.mergeResult.merged)
          }

          if (settings.syncSettings && result.syncResult?.mergedSettings) {
            replaceSettings(result.syncResult.mergedSettings)
          } else if (result.syncResult?.mergedCategories) {
            replaceCategories(result.syncResult.mergedCategories)
          }
        },
        onInSync: () => {
          addNotification(t("settings.notifications.alreadyInSync"), "success")
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
    clearDirtyDaysAfterSync,
    clearSettingsChangeFlag,
    replaceAllExpenses,
    replaceSettings,
    replaceCategories,
    t,
  ])

  return (
    <ScreenContainer>
      <YStack gap="$4" style={layoutStyles.container}>
        {/* DEFAULT PAYMENT METHOD Section */}
        <SettingsSection title={t("settings.sections.defaultPayment")}>
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
                    {t("settings.defaultPayment.label")}
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
                  {t("settings.defaultPayment.description")}
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
        <SettingsSection title={t("settings.sections.paymentInstruments")}>
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
        <SettingsSection title={t("settings.sections.github")}>
          <Text color="$color" opacity={0.7} fontSize="$3">
            {Platform.OS === "web"
              ? t("settings.github.descriptionWeb")
              : t("settings.github.descriptionNative")}
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

        <SettingsSection title={t("settings.sections.localization")}>
          <LocalizationSection
            languagePreference={settings.language}
            onLanguageChange={handleLanguageChange}
            defaultCurrency={settings.defaultCurrency}
            onCurrencyChange={handleCurrencyChange}
          />
        </SettingsSection>

        {/* APPEARANCE Section */}
        <SettingsSection title={t("settings.sections.appearance")}>
          <YStack gap="$2">
            <Label>{t("settings.appearance.theme")}</Label>
            <ThemeSelector value={settings.theme} onChange={handleThemeChange} />
          </YStack>
        </SettingsSection>

        {/* APP INFORMATION Section */}
        <SettingsSection title={t("settings.sections.about")}>
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
