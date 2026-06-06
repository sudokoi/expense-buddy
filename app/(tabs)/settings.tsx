import { useState, useCallback, useMemo } from "react"
import { YStack, XStack, Text, Button, Label, Switch } from "tamagui"
import { Alert, Linking, Platform, Pressable } from "react-native"
import { ChevronRight, RefreshCw } from "@tamagui/lucide-icons-2"
import { Href, useRouter } from "expo-router"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useSmsImportReview,
} from "../../stores/hooks"
import { useSyncHandler } from "../../hooks/use-sync-handler"
import { useUpdateCheck } from "../../hooks/use-update-check"
import { useReportIssue } from "../../hooks/use-report-issue"
import { testConnection, SyncConfig } from "../../services/sync-manager"
import { logAsync } from "../../services/logger"
import { UpdateInfo } from "../../services/update-checker"
import { APP_CONFIG } from "../../constants/app-config"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { ThemeSelector } from "../../components/ui/ThemeSelector"
import { SettingsSection } from "../../components/ui/SettingsSection"
import { ProviderManagementSection } from "../../components/ui/settings/ProviderManagementSection"
import { GoogleDriveConfigSection } from "../../components/ui/settings/GoogleDriveConfigSection"
import { GitHubConfigSection } from "../../components/ui/settings/GitHubConfigSection"
import { GitHubConfigModal } from "../../components/ui/settings/GitHubConfigModal"
import { AutoSyncSection } from "../../components/ui/settings/AutoSyncSection"
import { AppInfoSection } from "../../components/ui/settings/AppInfoSection"
import { LocalizationSection } from "../../components/ui/settings/LocalizationSection"
import { useTranslation } from "react-i18next"
import { SEMANTIC_COLORS } from "../../constants/theme-colors"
import type { ProviderConfig } from "../../services/sync/provider-types"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { UI_RADIUS, UI_SPACE, UI_OPACITY, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { requestBackgroundSmsPermissions } from "../../services/background-sms/background-sms-permissions"

export default function SettingsScreen() {
  const router = useRouter()
  const { t } = useTranslation()

  const { state } = useExpenses()
  const { addNotification } = useNotifications()
  const { pendingItems: pendingSmsImportItems } = useSmsImportReview()

  const { handleSync, isSyncing, syncButtonText, needsFirstSync, hasActiveProvider } =
    useSyncHandler()

  const {
    updateAvailable,
    latestVersion,
    isUpdateReadyToInstall,
    checkForUpdates: manualCheckForUpdates,
    handleUpdate: startUpdate,
  } = useUpdateCheck()

  const { handleReportIssue } = useReportIssue()

  const {
    settings,
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
    saveSyncConfig,
    clearSyncConfig,
  } = useSettings()
  const { isScanningSmsImports, openSmsImportReview, scanSmsImports } =
    useSmsImportActions()

  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )
  const [addingProviderKind, setAddingProviderKind] = useState<
    "github" | "google_drive" | null
  >(null)
  const [showGitHubEditor, setShowGitHubEditor] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  const isConfigured = syncConfig !== null || hasActiveProvider

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

  const handleSaveConfig = useCallback(
    async (config: SyncConfig) => {
      const isFirstTimeSetup = syncConfig === null

      await saveSyncConfig(config)
      addNotification(t("settings.github.successConfig"), "success")

      if (isFirstTimeSetup && state.expenses.length === 0) {
        handleSync()
      }
    },
    [syncConfig, state.expenses.length, saveSyncConfig, handleSync, addNotification, t]
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
    logAsync("INFO", "UI_ACTION", `SETTINGS_ADD_PROVIDER kind=${kind}`)
    setAddingProviderKind(kind)
    setShowGitHubEditor(false)
  }, [])

  const handleEditProvider = useCallback((_config: ProviderConfig) => {
    setShowGitHubEditor(true)
    setAddingProviderKind(null)
  }, [])

  const handleCheckForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true)
    try {
      await manualCheckForUpdates()
    } finally {
      setIsCheckingUpdate(false)
    }
  }, [manualCheckForUpdates])

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
            <GoogleDriveConfigSection
              onNotification={handleNotification}
              onCancel={() => setAddingProviderKind(null)}
              onDone={() => setAddingProviderKind(null)}
            />
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
                onSyncSettingsChange={setSyncSettings}
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
              <ThemeSelector value={settings.theme} onChange={setTheme} />
            </YStack>
          </YStack>
        </SettingsSection>

        <SettingsSection
          title={t("settings.sections.localization")}
          description={t("settings.localization.description")}
        >
          <LocalizationSection
            languagePreference={settings.language}
            onLanguageChange={setLanguage}
            defaultCurrency={settings.defaultCurrency}
            onCurrencyChange={setDefaultCurrency}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.sections.about")}>
          <AppInfoSection
            currentVersion={APP_CONFIG.version}
            updateInfo={updateInfo}
            isUpdateReadyToInstall={isUpdateReadyToInstall}
            isCheckingUpdate={isCheckingUpdate}
            onCheckForUpdates={handleCheckForUpdates}
            onStartUpdate={startUpdate}
            onOpenGitHub={() => Linking.openURL(APP_CONFIG.github.url)}
            onReportIssue={handleReportIssue}
          />
        </SettingsSection>
      </YStack>
    </ScreenContainer>
  )
}
