import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { YStack, XStack, Text, Button, Label, Switch } from "tamagui"
import { Alert, Linking, Platform, Pressable } from "react-native"
import { getLogsForBugReportAsync } from "../../services/logger"
import * as Clipboard from "expo-clipboard"
import { ChevronRight, RefreshCw } from "@tamagui/lucide-icons-2"
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
import { ProviderManagementSection } from "../../components/ui/settings/ProviderManagementSection"
import { GitHubConfigSection } from "../../components/ui/settings/GitHubConfigSection"
import { GitHubConfigModal } from "../../components/ui/settings/GitHubConfigModal"
import { AutoSyncSection } from "../../components/ui/settings/AutoSyncSection"
import { AppInfoSection } from "../../components/ui/settings/AppInfoSection"
import { LocalizationSection } from "../../components/ui/settings/LocalizationSection"
import { useTranslation } from "react-i18next"
import { SEMANTIC_COLORS } from "../../constants/theme-colors"
import { providerSettingsStore } from "../../services/sync/provider-settings-store"
import type { ProviderConfig } from "../../services/sync/provider-types"
import { credentialStore } from "../../services/sync/credential-store"
import { isProviderReconciled, markProviderReconciled } from "../../services/sync-queue"
import { GoogleOAuthError } from "../../services/sync/google-oauth-service"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { UI_RADIUS, UI_SPACE, UI_OPACITY, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { requestBackgroundSmsPermissions } from "../../services/background-sms/background-sms-permissions"

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
    isUpdateReadyToInstall,
    checkForUpdates: manualCheckForUpdates,
    handleUpdate: startUpdate,
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
    setBackgroundSmsImportEnabled,
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

  // Provider management state
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )
  const [addingProviderKind, setAddingProviderKind] = useState<
    "github" | "google_drive" | null
  >(null)
  const [showGitHubEditor, setShowGitHubEditor] = useState(false)
  const [activeProviderReconciled, setActiveProviderReconciled] = useState<
    boolean | null
  >(null)
  const [providerMutationVersion, setProviderMutationVersion] = useState(0)
  const syncQueueWatermarkRef = useRef<number | null>(null)

  // Derive isConfigured from both legacy syncConfig and new provider framework
  const isConfigured = syncConfig !== null || activeProviderReconciled !== null

  // Bump when provider mutations happen so reconciliation re-checks
  const handleProviderMutated = useCallback(() => {
    setProviderMutationVersion((v) => v + 1)
  }, [])

  // Check if active provider needs first sync
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const config = await providerSettingsStore.getActiveConfig()
        if (config && !cancelled) {
          const reconciled = await isProviderReconciled(config.id)
          if (!cancelled) setActiveProviderReconciled(reconciled)
        } else if (!cancelled) {
          setActiveProviderReconciled(null)
        }
      } catch {
        if (!cancelled) setActiveProviderReconciled(null)
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [syncConfig, providerMutationVersion])

  // Update check state - use hook's state for updateInfo
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  // Derive updateInfo from hook state for AppInfoSection compatibility
  const updateInfo: UpdateInfo | null = useMemo(() => {
    if (latestVersion || updateAvailable) {
      return {
        hasUpdate: updateAvailable,
        currentVersion: APP_CONFIG.version,
        latestVersion: latestVersion ?? undefined,
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

  const handleBackgroundSmsToggle = useCallback(
    async (enabled: boolean) => {
      try {
        if (!enabled) {
          await setBackgroundSmsImportEnabled(false)
          addNotification(
            t("settings.smsImport.notifications.backgroundDisabled"),
            "info"
          )
          return
        }

        const permissionResult = await requestBackgroundSmsPermissions()
        if (!permissionResult.granted) {
          addNotification(
            t("settings.smsImport.notifications.backgroundPermissionRequired"),
            "error"
          )
          return
        }

        await setBackgroundSmsImportEnabled(true)
        addNotification(
          t("settings.smsImport.notifications.backgroundEnabled"),
          "success"
        )
      } catch {
        addNotification(
          t("settings.smsImport.notifications.backgroundToggleFailed"),
          "error"
        )
      }
    },
    [addNotification, setBackgroundSmsImportEnabled, t]
  )

  // GitHub config handlers
  const handleSaveConfig = useCallback(
    async (config: SyncConfig) => {
      // Check if this is first-time configuration (no previous config existed)
      const isFirstTimeSetup = syncConfig === null

      await saveSyncConfig(config)
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

  const handleAddProvider = useCallback((kind: "github" | "google_drive") => {
    setAddingProviderKind(kind)
    setShowGitHubEditor(false)
  }, [])

  const handleEditProvider = useCallback((_config: ProviderConfig) => {
    setShowGitHubEditor(true)
    setAddingProviderKind(null)
  }, [])

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

  // Use hook's handleUpdate for the Play Store in-app update flow.
  const handleStartUpdate = useCallback(async () => {
    await startUpdate()
  }, [startUpdate])

  const handleOpenGitHub = useCallback(() => {
    Linking.openURL(APP_CONFIG.github.url)
  }, [])

  const handleReportIssue = useCallback(() => {
    const openNewIssue = () => {
      Linking.openURL(`${APP_CONFIG.github.url}/issues/new/choose`)
    }
    const openIssue = (issueNumber: number) => {
      Linking.openURL(`${APP_CONFIG.github.url}/issues/${issueNumber}`)
    }

    Alert.alert(
      t("settings.about.includeLogsTitle"),
      t("settings.about.includeLogsMessage"),
      [
        {
          text: t("settings.about.attachLogs"),
          onPress: async () => {
            const appRepo = APP_CONFIG.github.url.replace(/^https?:\/\/github\.com\//, "")

            // Look up GitHub provider credentials regardless of active sync provider
            let githubToken: string | undefined
            try {
              const state = await providerSettingsStore.load()
              const githubProvider = state.providers.find((p) => p.kind === "github")
              if (githubProvider) {
                const entry = await credentialStore.get(githubProvider.credentialId)
                if (entry) {
                  githubToken = entry.data["token"] ?? entry.data["access_token"]
                }
              }
            } catch {
              // Fall through to clipboard fallback
            }

            const logs = await getLogsForBugReportAsync(githubToken ? 500 : 50)

            if (githubToken && logs) {
              try {
                const response = await fetch(
                  `https://api.github.com/repos/${appRepo}/issues`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${githubToken}`,
                      Accept: "application/vnd.github+json",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      title: `[Bug Report] Expense Buddy v${APP_CONFIG.version}`,
                      body: [
                        "## Bug Description",
                        "",
                        "_Please describe the bug here._",
                        "",
                        "## Device Logs",
                        "```",
                        logs,
                        "```",
                      ].join("\n"),
                    }),
                  }
                )
                if (response.ok) {
                  const issue = (await response.json()) as {
                    number: number
                    html_url: string
                  }
                  addNotification(t("settings.about.issueCreated"), "success")
                  openIssue(issue.number)
                  return
                }
              } catch {
                // Fall through to clipboard fallback
              }
            }

            if (logs) {
              await Clipboard.setStringAsync(logs)
              addNotification(t("settings.about.logsCopied"), "info")
            }
            openNewIssue()
          },
        },
        {
          text: t("settings.about.dontAttach"),
          onPress: openNewIssue,
        },
        {
          text: t("common.cancel"),
          style: "cancel",
        },
      ]
    )
  }, [t, addNotification])

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
  const needsFirstSync = activeProviderReconciled === false
  const syncButtonText = useMemo(() => {
    if (isSyncing) return t("settings.autoSync.syncing")
    if (needsFirstSync) return t("settings.autoSync.firstSync")
    if (pendingCount > 0) return `${t("settings.autoSync.syncNow")} (${pendingCount})`
    return t("settings.autoSync.syncNow")
  }, [isSyncing, needsFirstSync, pendingCount, t])

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
          const localFilesUpdated =
            (result.mergeResult?.addedFromLocal.length ?? 0) +
            (result.mergeResult?.updatedFromLocal.length ?? 0)
          const remoteFilesUpdated =
            (result.mergeResult?.addedFromRemote.length ?? 0) +
            (result.mergeResult?.updatedFromRemote.length ?? 0)
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

          const activeConfig = await providerSettingsStore.getActiveConfig()
          if (activeConfig && !(await isProviderReconciled(activeConfig.id))) {
            await markProviderReconciled(activeConfig.id)
            handleProviderMutated()
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
    handleProviderMutated,
  ])

  return (
    <ScreenContainer>
      <YStack gap="$gutter" maxW={UI_SPACE.empty * 15} self="center" width="100%">
        <SettingsSection
          title={t("settings.sections.sync")}
          description={t("settings.sync.description")}
        >
          <ProviderManagementSection
            onNotification={handleNotification}
            onAddProvider={handleAddProvider}
            onEditProvider={handleEditProvider}
            onProviderMutated={handleProviderMutated}
          />

          {addingProviderKind === "github" && (
            <YStack mt={UI_SPACE.gutter}>
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
            </YStack>
          )}

          <GitHubConfigModal
            open={showGitHubEditor}
            onClose={() => setShowGitHubEditor(false)}
            syncConfig={syncConfig}
            onSaveConfig={handleSaveConfig}
            onTestConnection={handleTestConnection}
            onClearConfig={handleClearConfig}
            isTesting={isTesting}
            connectionStatus={connectionStatus}
            onConnectionStatusChange={handleConnectionStatusChange}
            onNotification={handleNotification}
          />

          {addingProviderKind === "google_drive" && (
            <YStack
              bg="$backgroundHover"
              p={UI_SPACE.section}
              rounded={UI_RADIUS.surface}
              gap="$control"
              mt={UI_SPACE.gutter}
            >
              <Label>{t("settings.googleDrive.configTitle")}</Label>
              <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
                {t("settings.googleDrive.help")}
              </Text>
              <Button
                size="$control"
                theme="accent"
                onPress={async () => {
                  const { getGoogleDriveOAuthClientId } =
                    await import("../../constants/runtime-config")
                  const clientId = getGoogleDriveOAuthClientId()
                  if (!clientId) {
                    handleNotification(t("settings.googleDrive.clientIdMissing"), "error")
                    return
                  }
                  try {
                    const { initiateGoogleDriveOAuth } =
                      await import("../../services/sync/google-oauth-service")
                    const result = await initiateGoogleDriveOAuth(clientId)
                    await providerSettingsStore.addProvider({
                      id: result.providerId,
                      kind: "google_drive",
                      label: "Google Drive",
                      credentialId: result.providerId,
                      clientId,
                      accountEmail: result.accountEmail,
                    })
                    setAddingProviderKind(null)
                    handleProviderMutated()
                    handleNotification(t("settings.googleDrive.configured"), "success")
                  } catch (error) {
                    if (error instanceof GoogleOAuthError && error.code === "CANCELLED") {
                      return
                    }
                    handleNotification(t("common.error"), "error")
                  }
                }}
              >
                {t("settings.providers.addGoogleDrive")}
              </Button>
              <Button size="$control" onPress={() => setAddingProviderKind(null)}>
                {t("common.cancel")}
              </Button>
            </YStack>
          )}

          {isConfigured && (
            <YStack gap="$gutter" mt={UI_SPACE.control}>
              <Button
                size="$control"
                onPress={handleSync}
                disabled={isSyncing}
                theme="accent"
                icon={isSyncing ? undefined : RefreshCw}
              >
                {syncButtonText}
              </Button>

              <AutoSyncSection
                autoSyncEnabled={settings.autoSyncEnabled}
                autoSyncTiming={settings.autoSyncTiming}
                syncSettings={settings.syncSettings}
                reconciliationRequired={needsFirstSync}
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
            gap="$gutter"
          >
            <XStack flexWrap="wrap" gap={UI_SPACE.control}>
              <Button onPress={handleScanSmsImports} disabled={isScanningSmsImports}>
                {isScanningSmsImports
                  ? t("settings.smsImport.actions.scanning")
                  : t("settings.smsImport.actions.scan")}
              </Button>
            </XStack>

            {pendingSmsImportItems.length > 0 ? (
              <XStack flexWrap="wrap" gap={UI_SPACE.control}>
                <Button onPress={openSmsImportReview}>
                  {t("settings.smsImport.actions.reviewWithPending", {
                    count: pendingSmsImportItems.length,
                  })}
                </Button>
              </XStack>
            ) : null}

            <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$caption">
              {t("settings.smsImport.helper")}
            </Text>

            <XStack
              bg="$backgroundHover"
              px="$section"
              py="$section"
              items="center"
              justify="space-between"
              rounded={UI_RADIUS.surface}
            >
              <YStack flex={1} gap="$micro">
                <Label>{t("settings.smsImport.backgroundAlerts")}</Label>
                <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$caption">
                  {t("settings.smsImport.backgroundAlertsHelp")}
                </Text>
              </YStack>
              <Switch
                size="$control"
                checked={settings.backgroundSmsImportEnabled}
                onCheckedChange={(checked) => {
                  void handleBackgroundSmsToggle(checked)
                }}
                bg="$gray8"
                activeStyle={{ backgroundColor: SEMANTIC_COLORS.success }}
              >
                <Switch.Thumb />
              </Switch>
            </XStack>
          </SettingsSection>
        ) : null}

        <SettingsSection
          title={t("settings.sections.payment")}
          description={t("settings.payment.description")}
          gap="$gutter"
        >
          <Pressable
            onPress={() => router.push("/settings/payment" as Href)}
            role="button"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <XStack
              bg="$backgroundHover"
              items="center"
              justify="space-between"
              px={UI_SPACE.section}
              py={UI_SPACE.section}
              rounded={UI_RADIUS.surface}
            >
              <YStack gap="$micro" flex={1} pointerEvents="none">
                <Label color="$color" opacity={UI_OPACITY.strong}>
                  {t("settings.payment.manageTitle")}
                </Label>
                <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$body">
                  {t("settings.payment.summary", {
                    defaultMethod: defaultPaymentMethodLabel,
                    instrumentCount: activePaymentInstrumentCount,
                  })}
                </Text>
                <Text color="$color" opacity={UI_OPACITY.faint} fontSize="$caption">
                  {t("settings.payment.manageHelp")}
                </Text>
              </YStack>
              <ChevronRight
                size={UI_ICON_SIZE.medium}
                color="$color"
                opacity={UI_OPACITY.subtle}
              />
            </XStack>
          </Pressable>
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.featureFlags")}
          description={t("settings.featureFlags.description")}
          gap="$gutter"
        >
          <XStack
            bg="$backgroundHover"
            px="$section"
            py="$section"
            items="center"
            justify="space-between"
            rounded={UI_RADIUS.surface}
          >
            <YStack flex={1} gap="$micro">
              <Label>{t("settings.general.mathEntry")}</Label>
              <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$caption">
                {t("settings.general.mathEntryHelp")}
              </Text>
            </YStack>
            <Switch
              size="$control"
              checked={settings.enableMathExpressions}
              onCheckedChange={setEnableMathExpressions}
              bg="$gray8"
              activeStyle={{ backgroundColor: SEMANTIC_COLORS.success }}
            >
              <Switch.Thumb />
            </Switch>
          </XStack>

          {Platform.OS === "android" ? (
            <XStack
              bg="$backgroundHover"
              px="$section"
              py="$section"
              items="center"
              justify="space-between"
              rounded={UI_RADIUS.surface}
            >
              <YStack flex={1} gap="$micro">
                <Label>{t("settings.featureFlags.mlOnlySmsImports")}</Label>
                <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$caption">
                  {t("settings.featureFlags.mlOnlySmsImportsHelp")}
                </Text>
              </YStack>
              <Switch
                size="$control"
                checked={settings.useMlOnlyForSmsImports}
                onCheckedChange={(checked) =>
                  updateSettings({ useMlOnlyForSmsImports: checked })
                }
                bg="$gray8"
                activeStyle={{ backgroundColor: SEMANTIC_COLORS.success }}
              >
                <Switch.Thumb />
              </Switch>
            </XStack>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.general")}
          description={t("settings.general.description")}
          gap="$gutter"
        >
          <YStack gap="$control">
            <Label>{t("settings.appearance.theme")}</Label>
            <YStack
              bg="$backgroundHover"
              p="$section"
              style={{ borderRadius: UI_RADIUS.surface }}
            >
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
            isUpdateReadyToInstall={isUpdateReadyToInstall}
            isCheckingUpdate={isCheckingUpdate}
            onCheckForUpdates={handleCheckForUpdates}
            onStartUpdate={handleStartUpdate}
            onOpenGitHub={handleOpenGitHub}
            onReportIssue={handleReportIssue}
          />
        </SettingsSection>
      </YStack>
    </ScreenContainer>
  )
}
