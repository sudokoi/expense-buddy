import { useState, useCallback, useMemo, useRef } from "react"
import { YStack, XStack, Text, Button, Label, Switch } from "tamagui"
import { Alert, Linking, ViewStyle, Platform, Pressable } from "react-native"
import { ChevronRight } from "@tamagui/lucide-icons"
import { Href, useRouter } from "expo-router"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useSmsImportReview,
} from "../../stores/hooks"
import {
  useSyncMachine,
  TrueConflict,
  ConflictResolution,
} from "../../hooks/use-sync-machine"
import { useUpdateCheck } from "../../hooks/use-update-check"
import { testConnection, SyncConfig, syncDown } from "../../services/sync-manager"
import {
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
  clearSyncOpsUpTo,
  getSyncOpsSince,
  getSyncQueueWatermark,
} from "../../services/sync-queue"
import { loadDirtyDays, saveDirtyDays } from "../../services/expense-dirty-days"
import { UpdateInfo } from "../../services/update-checker"
import { APP_CONFIG } from "../../constants/app-config"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { ThemeSelector } from "../../components/ui/ThemeSelector"
import { SettingsSection } from "../../components/ui/SettingsSection"
import { GitHubConfigSection } from "../../components/ui/settings/GitHubConfigSection"
import { AutoSyncSection } from "../../components/ui/settings/AutoSyncSection"
import { AppInfoSection } from "../../components/ui/settings/AppInfoSection"
import { LocalizationSection } from "../../components/ui/settings/LocalizationSection"
import { useTranslation } from "react-i18next"
import { SEMANTIC_COLORS } from "../../constants/theme-colors"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"

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
  groupedContent: {
    paddingTop: 14,
  } as ViewStyle,
  collapsibleHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  } as ViewStyle,
  switchRow: {
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  actionRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  menuRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  } as ViewStyle,
}

export default function SettingsScreen() {
  const router = useRouter()
  const { t } = useTranslation()

  const { state, replaceAllExpenses, clearDirtyDaysAfterSync } = useExpenses()
  const { addNotification } = useNotifications()
  const { pendingItems: pendingSmsImportItems } = useSmsImportReview()

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
    setDefaultCurrency,
    setLanguage,
    setEnableMathExpressions,
    updateSettings,
    setAutoSyncEnabled,
    setAutoSyncTiming,
    replaceSettings,
    clearSettingsChangeFlag,
    saveSyncConfig,
    clearSyncConfig,
  } = useSettings()
  const { isScanningSmsImports, openSmsImportReview, scanSmsImports } =
    useSmsImportActions()

  // GitHub config state
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )
  const syncQueueWatermarkRef = useRef<number | null>(null)

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

  const defaultPaymentMethodLabel = useMemo(() => {
    const value = settings.defaultPaymentMethod
    if (!value) return t("settings.defaultPayment.none")
    const match = PAYMENT_METHODS.find((m) => m.value === value)
    return match?.label ?? value
  }, [settings.defaultPaymentMethod, t])
  const activePaymentInstrumentCount = useMemo(
    () =>
      (settings.paymentInstruments ?? []).filter((instrument) => !instrument.deletedAt)
        .length,
    [settings.paymentInstruments]
  )

  const handleScanSmsImports = useCallback(async () => {
    await scanSmsImports()
  }, [scanSmsImports])

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
  const handleSync = useCallback(async () => {
    const dirtyDaysState = await loadDirtyDays()
    await saveDirtyDays({
      ...dirtyDaysState.state,
      dirtyDays: state.dirtyDays,
      deletedDays: state.deletedDays,
      updatedAt: new Date().toISOString(),
    })
    syncQueueWatermarkRef.current = await getSyncQueueWatermark()
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
        onSuccess: async (result) => {
          const localFilesUpdated = result.syncResult?.localFilesUpdated ?? 0
          const remoteFilesUpdated = result.syncResult?.remoteFilesUpdated ?? 0
          addNotification(
            t("settings.notifications.syncComplete", {
              localCount: localFilesUpdated,
              remoteCount: remoteFilesUpdated,
            }),
            "success"
          )

          const watermark = syncQueueWatermarkRef.current
          let opsAfter = watermark !== null ? await getSyncOpsSince(watermark) : []
          if (watermark !== null && opsAfter.length === 0) {
            const latestWatermark = await getSyncQueueWatermark()
            if (latestWatermark > watermark) {
              opsAfter = await getSyncOpsSince(watermark)
            }
          }

          const baseExpenses = result.mergeResult?.merged ?? state.expenses
          const reconciledExpenses = applyQueuedOpsToExpenses(baseExpenses, opsAfter)
          const pendingExpenseOps = opsAfter.some((op) => op.type.startsWith("expense."))
          const pendingSettingsOps = opsAfter.some(
            (op) => op.type.startsWith("settings.") || op.type.startsWith("category.")
          )

          let settingsBase = settings
          if (result.syncResult?.mergedSettings) {
            settingsBase = result.syncResult.mergedSettings
          } else if (result.syncResult?.mergedCategories) {
            settingsBase = {
              ...settingsBase,
              categories: result.syncResult.mergedCategories,
            }
          }

          const reconciledSettings = applyQueuedOpsToSettings(settingsBase, opsAfter)

          if (watermark !== null) {
            const lastAppliedId =
              opsAfter.length > 0 ? opsAfter[opsAfter.length - 1].id : watermark
            await clearSyncOpsUpTo(lastAppliedId)
          }

          if (!pendingExpenseOps) {
            clearDirtyDaysAfterSync()
          }
          if (settings.syncSettings && !pendingSettingsOps) {
            clearSettingsChangeFlag()
          }

          if (reconciledExpenses.length > 0) {
            replaceAllExpenses(reconciledExpenses)
          }

          if (settings.syncSettings && result.syncResult?.mergedSettings) {
            replaceSettings(reconciledSettings)
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
    state.dirtyDays,
    state.deletedDays,
    state.expenses,
    syncMachine,
    settings,
    clearSyncConfig,
    showConflictDialog,
    addNotification,
    t,
    clearDirtyDaysAfterSync,
    clearSettingsChangeFlag,
    replaceAllExpenses,
    replaceSettings,
  ])

  return (
    <ScreenContainer>
      <YStack gap="$4" style={layoutStyles.container}>
        <SettingsSection
          title={t("settings.sections.sync")}
          description={t("settings.sync.description")}
        >
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

          {isConfigured && (
            <YStack gap="$4" style={layoutStyles.syncButtonsContainer}>
              <Button size="$4" onPress={handleSync} disabled={isSyncing} themeInverse>
                {syncButtonText}
              </Button>

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

        {Platform.OS === "android" ? (
          <SettingsSection
            title={t("settings.smsImport.title")}
            description={t("settings.smsImport.description")}
            gap="$4"
          >
            <XStack style={layoutStyles.actionRow}>
              <Button onPress={handleScanSmsImports} disabled={isScanningSmsImports}>
                {isScanningSmsImports
                  ? t("settings.smsImport.actions.scanning")
                  : t("settings.smsImport.actions.scan")}
              </Button>
            </XStack>

            {pendingSmsImportItems.length > 0 ? (
              <XStack style={layoutStyles.actionRow}>
                <Button onPress={openSmsImportReview}>
                  {t("settings.smsImport.actions.reviewWithPending", {
                    count: pendingSmsImportItems.length,
                  })}
                </Button>
              </XStack>
            ) : null}

            <Text color="$color" opacity={0.65} fontSize="$2">
              {t("settings.smsImport.helper")}
            </Text>
          </SettingsSection>
        ) : null}

        <SettingsSection
          title={t("settings.sections.payment")}
          description={t("settings.payment.description")}
          gap="$4"
        >
          <Pressable
            onPress={() => router.push("/settings/payment" as Href)}
            accessibilityRole="button"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <XStack bg="$backgroundHover" style={layoutStyles.menuRow}>
              <YStack gap="$1" flex={1} pointerEvents="none">
                <Label color="$color" opacity={0.82}>
                  {t("settings.payment.manageTitle")}
                </Label>
                <Text color="$color" opacity={0.62} fontSize="$3">
                  {t("settings.payment.summary", {
                    defaultMethod: defaultPaymentMethodLabel,
                    instrumentCount: activePaymentInstrumentCount,
                  })}
                </Text>
                <Text color="$color" opacity={0.5} fontSize="$2">
                  {t("settings.payment.manageHelp")}
                </Text>
              </YStack>
              <ChevronRight size={20} color="$color" opacity={0.6} />
            </XStack>
          </Pressable>
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.featureFlags")}
          description={t("settings.featureFlags.description")}
          gap="$4"
        >
          <XStack
            bg="$backgroundHover"
            px="$3"
            py="$3"
            style={[layoutStyles.switchRow, { borderRadius: 16 }]}
          >
            <YStack flex={1} gap="$1">
              <Label>{t("settings.general.mathEntry")}</Label>
              <Text color="$color" opacity={0.6} fontSize="$2">
                {t("settings.general.mathEntryHelp")}
              </Text>
            </YStack>
            <Switch
              size="$4"
              checked={settings.enableMathExpressions}
              onCheckedChange={setEnableMathExpressions}
              backgroundColor={
                settings.enableMathExpressions
                  ? SEMANTIC_COLORS.success
                  : ("$gray8" as any)
              }
            >
              <Switch.Thumb />
            </Switch>
          </XStack>

          {Platform.OS === "android" ? (
            <XStack
              bg="$backgroundHover"
              px="$3"
              py="$3"
              style={[layoutStyles.switchRow, { borderRadius: 16 }]}
            >
              <YStack flex={1} gap="$1">
                <Label>{t("settings.featureFlags.mlOnlySmsImports")}</Label>
                <Text color="$color" opacity={0.6} fontSize="$2">
                  {t("settings.featureFlags.mlOnlySmsImportsHelp")}
                </Text>
              </YStack>
              <Switch
                size="$4"
                checked={settings.useMlOnlyForSmsImports}
                onCheckedChange={(checked) =>
                  updateSettings({ useMlOnlyForSmsImports: checked })
                }
                backgroundColor={
                  settings.useMlOnlyForSmsImports
                    ? SEMANTIC_COLORS.success
                    : ("$gray8" as any)
                }
              >
                <Switch.Thumb />
              </Switch>
            </XStack>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.general")}
          description={t("settings.general.description")}
          gap="$4"
        >
          <YStack gap="$2">
            <Label>{t("settings.appearance.theme")}</Label>
            <YStack bg="$backgroundHover" p="$3" style={{ borderRadius: 16 }}>
              <ThemeSelector value={settings.theme} onChange={handleThemeChange} />
            </YStack>
          </YStack>
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.localization")}
          description={t("settings.localization.description")}
        >
          <LocalizationSection
            languagePreference={settings.language}
            onLanguageChange={handleLanguageChange}
            defaultCurrency={settings.defaultCurrency}
            onCurrencyChange={handleCurrencyChange}
          />
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
