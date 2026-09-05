import { useState, useCallback, useMemo } from "react"
import { Alert, Linking, Platform, Pressable, Text, View } from "react-native"
import { getLogsForBugReportAsync } from "../../services/logger"
import * as Clipboard from "expo-clipboard"
import {
  ChevronRight,
  FileDown,
  GitBranch,
  MessageSquare,
  Wallet,
  SlidersHorizontal,
  Palette,
  Globe,
  Info,
} from "lucide-react-native"
import { Href, useRouter } from "expo-router"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useExpenses, useNotifications, useSettings } from "../../stores/hooks"
import { useSmsImportReview } from "../../providers/sms-import-review-provider"
import { useUpdateCheck } from "../../hooks/use-update-check"
import { useSyncAction } from "../../hooks/use-sync-action"
import { useExportAction } from "../../hooks/use-export-action"
import { testConnection, SyncConfig, syncDown } from "../../services/sync-manager"
import { UpdateInfo } from "../../services/update-checker"
import { APP_CONFIG } from "../../constants/app-config"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { ThemeSelector } from "../../components/ui/ThemeSelector"
import { SettingsSection } from "../../components/ui/SettingsSection"
import { GitHubConfigSection } from "../../components/ui/settings/GitHubConfigSection"
import { AutoSyncSection } from "../../components/ui/settings/AutoSyncSection"
import { AppInfoSection } from "../../components/ui/settings/AppInfoSection"
import { LocalizationSection } from "../../components/ui/settings/LocalizationSection"
import { Button } from "../../components/ui/Button"
import { Label } from "../../components/ui/Label"
import { Switch } from "../../components/ui/Switch"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { UI_OPACITY, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { requestBackgroundSmsPermissions } from "../../services/background-sms/background-sms-permissions"

/**
 * Counts the number of log entries in the bug-report string. Each entry starts
 * with a "[yyyy-MM-dd ..." timestamp; stacktrace continuation lines do not, so
 * this reflects the actual number of entries that will be attached/copied.
 */
function countAttachedLogEntries(logs: string): number {
  if (!logs) return 0
  const matches = logs.match(/^\[\d{4}-\d{2}-\d{2} /gm)
  return matches ? matches.length : 0
}

export default function SettingsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const theme = useThemeColors()

  const { state, replaceAllExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const { pendingItems: pendingSmsImportItems } = useSmsImportReview()

  // Same sync path the rest of the app uses: conflict resolution plus
  // post-sync reconciliation keep the pending count accurate after a merge.
  const { handleSync, isSyncing, pendingCount } = useSyncAction()

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
    syncConfig,
    setTheme,
    setSyncSettings,
    setDefaultCurrency,
    setLanguage,
    setSmsRegion,
    setEnableMathExpressions,
    setBackgroundSmsImportEnabled,
    updateSettings,
    setAutoSyncEnabled,
    setAutoSyncTiming,
    replaceSettings,
    saveSyncConfig,
    clearSyncConfig,
  } = useSettings()
  const { isScanningSmsImports, openSmsImportReview, scanSmsImports } =
    useSmsImportActions()

  // GitHub config state
  const [isTesting, setIsTesting] = useState(false)
  const { handleExport: handleExportCsv, isExporting } = useExportAction()
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )

  // Derive isConfigured from syncConfig !== null
  const isConfigured = syncConfig !== null

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
    return match ? t(`paymentMethods.${match.i18nKey}`) : value
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
    // GitHubConfigSection owns the confirmation; don't prompt a second time.
    clearSyncConfig()
    setConnectionStatus("idle")
    addNotification(t("settings.notifications.configCleared"), "success")
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

  // Use hook's handleUpdate for the Play Store in-app update flow.
  const handleStartUpdate = useCallback(async () => {
    await startUpdate()
  }, [startUpdate])

  const handleOpenGitHub = useCallback(() => {
    Linking.openURL(APP_CONFIG.github.url)
  }, [])

  const handleReportIssue = useCallback(async () => {
    const token = syncConfig?.token
    const appRepo = APP_CONFIG.github.url.replace(/^https?:\/\/github\.com\//, "")
    // Signed in: attach up to 500 logs via the API. Otherwise: copy up to 200
    // to the clipboard. Fetch first so the prompt can show the real count.
    const maxLogs = token ? 500 : 200
    const logs = await getLogsForBugReportAsync(maxLogs)
    const logCount = countAttachedLogEntries(logs)

    const openNewIssue = () => {
      Linking.openURL(`${APP_CONFIG.github.url}/issues/new/choose`)
    }
    const openIssue = (issueNumber: number) => {
      Linking.openURL(`${APP_CONFIG.github.url}/issues/${issueNumber}`)
    }

    Alert.alert(
      t("settings.about.includeLogsTitle", {
        defaultValue: "Include Device Logs?",
      }),
      t("settings.about.includeLogsMessage", {
        count: logCount,
        defaultValue:
          "{{count}} recent device logs will be attached to help debug the issue. They contain app operation details only — no SMS content, financial data, or personal information.",
      }),
      [
        {
          text: t("settings.about.attachLogs", {
            defaultValue: "Attach Logs",
          }),
          onPress: async () => {
            if (token && logs) {
              try {
                const response = await fetch(
                  `https://api.github.com/repos/${appRepo}/issues`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token}`,
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
                  addNotification(
                    t("settings.about.issueCreated", {
                      defaultValue: "Issue created. Add details in the browser.",
                    }),
                    "success"
                  )
                  openIssue(issue.number)
                  return
                }
              } catch {
                // Fall through to clipboard fallback
              }
            }

            if (logs) {
              await Clipboard.setStringAsync(logs)
              addNotification(
                t("settings.about.logsCopied", {
                  defaultValue:
                    "Logs copied to clipboard. Paste them in the GitHub issue.",
                }),
                "info"
              )
            }
            openNewIssue()
          },
        },
        {
          text: t("settings.about.dontAttach", { defaultValue: "Don't Attach" }),
          onPress: openNewIssue,
        },
        {
          text: t("common.cancel", { defaultValue: "Cancel" }),
          style: "cancel",
        },
      ]
    )
  }, [t, addNotification, syncConfig])

  // Theme and settings handlers
  const handleThemeChange = useCallback(
    (theme: "light" | "dark" | "system") => {
      setTheme(theme)
    },
    [setTheme]
  )

  const handleLanguageChange = useCallback(
    (lang: string) => {
      if (lang === settings.language) {
        return
      }

      // Language change resets currency and SMS region per the language maps
      // (ADR-010). Warn before applying since overrides are stomped.
      Alert.alert(
        t("settings.localization.languageChangeTitle", {
          defaultValue: "Change Language?",
        }),
        t("settings.localization.languageChangeMessage", {
          defaultValue:
            "Changing the language also resets your default currency and SMS region to match it.",
        }),
        [
          {
            text: t("common.cancel", { defaultValue: "Cancel" }),
            style: "cancel",
          },
          {
            text: t("settings.localization.languageChangeConfirm", {
              defaultValue: "Change",
            }),
            onPress: () => setLanguage(lang),
          },
        ]
      )
    },
    [setLanguage, settings.language, t]
  )

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      setDefaultCurrency(currency)
    },
    [setDefaultCurrency]
  )

  const handleRegionChange = useCallback(
    (region: string) => {
      setSmsRegion(region)
    },
    [setSmsRegion]
  )

  const handleSyncSettingsToggle = useCallback(
    (enabled: boolean) => {
      setSyncSettings(enabled)
    },
    [setSyncSettings]
  )

  // Keep the action label concise; pending changes are explained separately.
  const syncButtonText = useMemo(() => {
    if (isSyncing) return t("settings.autoSync.syncing")
    return t("settings.autoSync.syncNow")
  }, [isSyncing, t])

  return (
    <ScreenContainer>
      <View className="max-w-[600px] w-full self-center gap-4">
        <SettingsSection
          title={t("settings.sections.sync")}
          icon={GitBranch}
          tone="purple"
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
            <View className="gap-4 mt-2">
              {pendingCount > 0 ? (
                <Text
                  className="text-sm text-muted-foreground"
                  accessibilityLiveRegion="polite"
                >
                  {t("settings.autoSync.pendingChanges")}
                </Text>
              ) : null}
              <Button
                size="control"
                onPress={handleSync}
                disabled={isSyncing}
                variant="accent"
                accessibilityLabel={syncButtonText}
              >
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
            </View>
          )}
        </SettingsSection>

        {Platform.OS === "android" ? (
          <SettingsSection
            title={t("settings.smsImport.title")}
            icon={MessageSquare}
            tone="blue"
            description={t("settings.smsImport.description")}
            gap="$gutter"
          >
            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="outline"
                onPress={handleScanSmsImports}
                disabled={isScanningSmsImports}
                accessibilityLabel={t("settings.smsImport.actions.scan")}
              >
                {isScanningSmsImports
                  ? t("settings.smsImport.actions.scanning")
                  : t("settings.smsImport.actions.scan")}
              </Button>
            </View>

            {pendingSmsImportItems.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  onPress={openSmsImportReview}
                  accessibilityLabel={t("settings.smsImport.actions.reviewWithPending", {
                    count: pendingSmsImportItems.length,
                  })}
                >
                  {t("settings.smsImport.actions.reviewWithPending", {
                    count: pendingSmsImportItems.length,
                  })}
                </Button>
              </View>
            ) : null}

            <Text className="text-xs text-foreground opacity-60">
              {t("settings.smsImport.helper")}
            </Text>

            <View className="bg-surface px-3 py-3 flex-row items-center justify-between rounded-card">
              <View className="flex-1 gap-1">
                <Label>{t("settings.smsImport.backgroundAlerts")}</Label>
                <Text className="text-xs text-foreground opacity-60">
                  {t("settings.smsImport.backgroundAlertsHelp")}
                </Text>
              </View>
              <Switch
                checked={settings.backgroundSmsImportEnabled}
                onCheckedChange={(checked) => {
                  void handleBackgroundSmsToggle(checked)
                }}
                accessibilityLabel={t("settings.smsImport.backgroundAlerts")}
              />
            </View>
          </SettingsSection>
        ) : null}

        <SettingsSection
          title={t("settings.sections.payment")}
          icon={Wallet}
          tone="orange"
          description={t("settings.payment.description")}
          gap="$gutter"
        >
          <Pressable
            onPress={() => router.push("/settings/payment" as Href)}
            role="button"
            accessibilityLabel={t("settings.payment.manageTitle")}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <View className="bg-surface flex-row items-center justify-between px-3 py-3 rounded-card">
              <View className="flex-1 gap-1" pointerEvents="none">
                <Label className="opacity-80">{t("settings.payment.manageTitle")}</Label>
                <Text className="text-[13px] text-foreground opacity-60">
                  {t("settings.payment.summary", {
                    defaultMethod: defaultPaymentMethodLabel,
                    instrumentCount: activePaymentInstrumentCount,
                  })}
                </Text>
                <Text className="text-xs text-foreground opacity-50">
                  {t("settings.payment.manageHelp")}
                </Text>
              </View>
              <ChevronRight
                size={UI_ICON_SIZE.medium}
                color={theme.foreground}
                style={{ opacity: UI_OPACITY.subtle }}
              />
            </View>
          </Pressable>
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.featureFlags")}
          icon={SlidersHorizontal}
          tone="blue"
          description={t("settings.featureFlags.description")}
          gap="$gutter"
        >
          <View className="bg-surface px-3 py-3 flex-row items-center justify-between rounded-card">
            <View className="flex-1 gap-1">
              <Label>{t("settings.general.mathEntry")}</Label>
              <Text className="text-xs text-foreground opacity-60">
                {t("settings.general.mathEntryHelp")}
              </Text>
            </View>
            <Switch
              checked={settings.enableMathExpressions}
              onCheckedChange={setEnableMathExpressions}
              accessibilityLabel={t("settings.general.mathEntry")}
            />
          </View>

          {Platform.OS === "android" ? (
            <View className="bg-surface px-3 py-3 flex-row items-center justify-between rounded-card">
              <View className="flex-1 gap-1">
                <Label>{t("settings.featureFlags.mlOnlySmsImports")}</Label>
                <Text className="text-xs text-foreground opacity-60">
                  {t("settings.featureFlags.mlOnlySmsImportsHelp")}
                </Text>
              </View>
              <Switch
                checked={settings.useMlOnlyForSmsImports}
                onCheckedChange={(checked) =>
                  updateSettings({ useMlOnlyForSmsImports: checked })
                }
                accessibilityLabel={t("settings.featureFlags.mlOnlySmsImports")}
              />
            </View>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.general")}
          icon={Palette}
          tone="purple"
          description={t("settings.general.description")}
          gap="$gutter"
        >
          <View className="gap-2">
            <Label>{t("settings.appearance.theme")}</Label>
            <ThemeSelector value={settings.theme} onChange={handleThemeChange} />
          </View>

          <View className="gap-2">
            <Label>{t("settings.general.exportLabel")}</Label>
            <Button
              size="control"
              variant="accent"
              icon={<FileDown size={UI_ICON_SIZE.small} />}
              onPress={handleExportCsv}
              disabled={isExporting}
              accessibilityLabel={t("settings.general.exportButton")}
            >
              {isExporting
                ? t("settings.general.exporting")
                : t("settings.general.exportButton")}
            </Button>
            <Text className="text-xs text-foreground opacity-50 px-1">
              {t("settings.general.exportHelp")}
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.localization")}
          icon={Globe}
          tone="green"
          description={t("settings.localization.description")}
        >
          <LocalizationSection
            languagePreference={settings.language}
            onLanguageChange={handleLanguageChange}
            defaultCurrency={settings.defaultCurrency}
            onCurrencyChange={handleCurrencyChange}
            smsRegion={settings.smsRegion}
            onRegionChange={handleRegionChange}
          />
        </SettingsSection>

        {/* APP INFORMATION Section */}
        <SettingsSection title={t("settings.sections.about")} icon={Info} tone="orange">
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
      </View>
    </ScreenContainer>
  )
}
