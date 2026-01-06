import { useState, useCallback, useMemo } from "react"
import {
  YStack,
  XStack,
  Text,
  Input,
  Button,
  Label,
  Switch,
  RadioGroup,
  Accordion,
} from "tamagui"
import { Alert, Keyboard, Linking, ViewStyle } from "react-native"
import { Check, X, Download, ExternalLink, ChevronDown } from "@tamagui/lucide-icons"
import {
  testConnection,
  SyncConfig,
  analyzeConflicts,
  smartMerge,
} from "../../services/sync-manager"
import { validateGitHubConfig } from "../../utils/github-config-validation"
import { AutoSyncTiming } from "../../services/settings-manager"
import { Expense, PaymentMethodType } from "../../types/expense"
import { useExpenses, useNotifications, useSettings } from "../../stores"
import { useSmartSync, useSyncPush, useSyncPull } from "../../hooks/use-sync"
import {
  checkForUpdates,
  UpdateInfo,
  isPlayStoreInstall,
} from "../../services/update-checker"
import { APP_CONFIG } from "../../constants/app-config"
import {
  ScreenContainer,
  ThemeSelector,
  SettingsSection,
  DefaultPaymentMethodSelector,
} from "../../components/ui"
import { SEMANTIC_COLORS, ACCENT_COLORS } from "../../constants/theme-colors"
import type { AppSettings } from "../../services/settings-manager"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  container: {
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,
  buttonRow: {
    flexWrap: "wrap",
  } as ViewStyle,
  autoSyncRow: {
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  radioRow: {
    alignItems: "center",
    marginVertical: 8,
  } as ViewStyle,
  versionRow: {
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  helperText: {
    marginTop: 4,
  },
  clearButton: {
    marginTop: 16,
  } as ViewStyle,
  accordionTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
  } as ViewStyle,
  accordionTriggerInner: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  } as ViewStyle,
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  } as ViewStyle,
  accordionContent: {
    padding: 8,
    paddingTop: 12,
  } as ViewStyle,
  syncButtonsContainer: {
    marginTop: 8,
  } as ViewStyle,
}

// Memoized theme colors
const successColor = SEMANTIC_COLORS.success
const errorColor = SEMANTIC_COLORS.error
const primaryColor = ACCENT_COLORS.primary

export default function SettingsScreen() {
  const { state, replaceAllExpenses, clearPendingChangesAfterSync } = useExpenses()
  const { addNotification } = useNotifications()

  const pushMutation = useSyncPush()
  const pullMutation = useSyncPull()
  const smartSyncMutation = useSmartSync()
  const isSyncing =
    pushMutation.isPending || pullMutation.isPending || smartSyncMutation.isPending

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

  // Initialize form state from store values (syncConfig loaded during store initialization)
  const [token, setToken] = useState(syncConfig?.token ?? "")
  const [repo, setRepo] = useState(syncConfig?.repo ?? "")
  const [branch, setBranch] = useState(syncConfig?.branch ?? "main")
  const [isTesting, setIsTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )

  // Derive isConfigured from syncConfig !== null
  const isConfigured = syncConfig !== null

  // Update check state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  // GitHub config validation errors
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})

  const performSmartMerge = useCallback(
    async (
      remoteExpenses: Expense[],
      summary: string,
      downloadedSettings?: AppSettings
    ) => {
      try {
        const mergeResult = await smartMerge(state.expenses, remoteExpenses)

        // Update local state with merged data
        replaceAllExpenses(mergeResult.merged)

        // Apply downloaded settings if available and settings sync is enabled
        if (downloadedSettings && settings.syncSettings) {
          replaceSettings(downloadedSettings)
        }

        // Clear pending changes since we've merged
        clearPendingChangesAfterSync()

        const messageParts = [`Merged successfully: ${summary}`]
        // Note: summary from handlePull already includes "settings updated" text if applicable
        // so we don't need to append it again here if it's already in the summary
        if (
          downloadedSettings &&
          settings.syncSettings &&
          !summary.includes("settings")
        ) {
          messageParts.push("settings applied")
        }
        addNotification(messageParts.join(", "), "success")
      } catch (error) {
        addNotification(`Merge failed: ${String(error)}`, "error")
      }
    },
    [
      state.expenses,
      settings.syncSettings,
      clearPendingChangesAfterSync,
      replaceAllExpenses,
      replaceSettings,
      addNotification,
    ]
  )

  // Memoized handlers
  const handleSaveConfig = useCallback(async () => {
    // Dismiss keyboard to ensure button press is captured
    Keyboard.dismiss()

    // Validate GitHub configuration with Zod
    const validation = validateGitHubConfig({ token, repo, branch })

    if (!validation.success) {
      setConfigErrors(validation.errors)
      addNotification("Please fix the validation errors", "error")
      return
    }

    // Clear errors on successful validation
    setConfigErrors({})

    // Check if this is first-time configuration (no previous config existed)
    const isFirstTimeSetup = syncConfig === null

    const config: SyncConfig = { token, repo, branch }
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
            onPress: () => {
              pullMutation.mutate(
                { daysToDownload: 7, syncSettingsEnabled: settings.syncSettings },
                {
                  onSuccess: (result) => {
                    if (result.success && result.expenses) {
                      replaceAllExpenses(result.expenses)
                      addNotification(
                        `Downloaded ${result.expenses.length} expenses`,
                        "success"
                      )

                      if (result.settings && settings.syncSettings) {
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
                  },
                  onError: (error) => {
                    addNotification(String(error), "error")
                  },
                }
              )
            },
          },
        ]
      )
    }
  }, [
    token,
    repo,
    branch,
    syncConfig,
    state.expenses.length,
    settings.syncSettings,
    settings.autoSyncEnabled,
    saveSyncConfig,
    setAutoSyncEnabled,
    pullMutation,
    replaceAllExpenses,
    replaceSettings,
    addNotification,
  ])

  const handleTestConnection = useCallback(async () => {
    Keyboard.dismiss()
    setIsTesting(true)
    setConnectionStatus("idle")

    const result = await testConnection()

    setIsTesting(false)
    if (result.success) {
      setConnectionStatus("success")
      addNotification(result.message, "success")
    } else {
      setConnectionStatus("error")
      addNotification(result.error || result.message, "error")
    }
  }, [addNotification])

  const handlePush = useCallback(() => {
    pushMutation.mutate(
      {
        expenses: state.expenses,
        settings: settings.syncSettings ? settings : undefined,
        syncSettingsEnabled: settings.syncSettings,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            addNotification(result.message, "success")
            clearPendingChangesAfterSync()
            if (settings.syncSettings && result.settingsSynced) {
              clearSettingsChangeFlag()
            }
          } else {
            addNotification(result.error || result.message, "error")
          }
        },
        onError: (error) => {
          addNotification(String(error), "error")
        },
      }
    )
  }, [
    pushMutation,
    state.expenses,
    settings,
    addNotification,
    clearPendingChangesAfterSync,
    clearSettingsChangeFlag,
  ])

  const handlePull = useCallback(async () => {
    pullMutation.mutate(
      {
        daysToDownload: 7,
        syncSettingsEnabled: settings.syncSettings,
      },
      {
        onSuccess: async (downloadResult) => {
          if (!downloadResult.success) {
            addNotification(downloadResult.error || "Failed to download", "error")
            return
          }

          const analysis = await analyzeConflicts(state.expenses)

          if (!analysis.success) {
            addNotification(analysis.error || "Failed to analyze conflicts", "error")
            return
          }

          const downloadedSettings = downloadResult.settings
          const conflicts = analysis.conflicts!
          const remoteExpenses = analysis.remoteExpenses!

          const hasRemoteUpdates = conflicts.remoteWins > 0
          const hasNewFromRemote = conflicts.newFromRemote > 0
          const hasLocalOnly = conflicts.newFromLocal > 0
          const hasDeletedLocally = conflicts.deletedLocally > 0
          const settingsDownloaded = !!downloadedSettings

          const summaryParts: string[] = []
          if (conflicts.newFromRemote > 0)
            summaryParts.push(`${conflicts.newFromRemote} new`)
          if (conflicts.remoteWins > 0)
            summaryParts.push(`${conflicts.remoteWins} updated`)
          if (conflicts.localWins > 0)
            summaryParts.push(`${conflicts.localWins} local kept`)
          if (conflicts.deletedLocally > 0)
            summaryParts.push(`${conflicts.deletedLocally} deleted locally`)

          if (settingsDownloaded) {
            summaryParts.push("settings updated")
          }

          const changesSummary =
            summaryParts.length > 0 ? summaryParts.join(", ") : "No changes"

          if (
            !hasRemoteUpdates &&
            !hasNewFromRemote &&
            !hasLocalOnly &&
            !hasDeletedLocally &&
            conflicts.localWins === 0 &&
            !settingsDownloaded
          ) {
            addNotification("Already in sync - no changes needed", "success")
            return
          }

          // Case where we only have settings updates but no expense conflicts
          if (
            !hasRemoteUpdates &&
            !hasNewFromRemote &&
            !hasLocalOnly &&
            !hasDeletedLocally &&
            conflicts.localWins === 0 &&
            settingsDownloaded
          ) {
            replaceSettings(downloadedSettings)
            addNotification(`Synced from GitHub: ${changesSummary}`, "success")
            return
          }

          if (hasRemoteUpdates) {
            Alert.alert(
              "Merge Conflicts Detected",
              `${conflicts.remoteWins} record(s) on GitHub are newer than your local version and will overwrite them.\n\nSummary: ${changesSummary}\n\nProceed with merge?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Merge",
                  onPress: () =>
                    performSmartMerge(remoteExpenses, changesSummary, downloadedSettings),
                },
              ]
            )
          } else {
            await performSmartMerge(remoteExpenses, changesSummary, downloadedSettings)
          }
        },
        onError: (error) => {
          addNotification(String(error), "error")
        },
      }
    )
  }, [
    pullMutation,
    state.expenses,
    settings.syncSettings,
    replaceSettings,
    addNotification,
    performSmartMerge,
  ])

  const handleClearConfig = useCallback(() => {
    Alert.alert("Confirm Clear", "Remove sync configuration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearSyncConfig()
          setToken("")
          setRepo("")
          setBranch("main")
          setConnectionStatus("idle")
          addNotification("Configuration cleared", "success")
        },
      },
    ])
  }, [clearSyncConfig, addNotification])

  const handleCheckForUpdates = useCallback(async () => {
    const fromPlayStore = await isPlayStoreInstall()
    if (fromPlayStore) {
      Linking.openURL(APP_CONFIG.playStore.url)
      return
    }

    setIsCheckingUpdate(true)
    const info = await checkForUpdates()
    setUpdateInfo(info)
    setIsCheckingUpdate(false)

    if (info.error) {
      addNotification(info.error, "error")
    } else if (info.hasUpdate) {
      addNotification(`Update available: v${info.latestVersion}`, "success")
    } else {
      addNotification("You're on the latest version", "success")
    }
  }, [addNotification])

  const handleOpenRelease = useCallback(() => {
    if (updateInfo?.releaseUrl) {
      Linking.openURL(updateInfo.releaseUrl)
    }
  }, [updateInfo])

  const handleOpenGitHub = useCallback(() => {
    Linking.openURL(APP_CONFIG.github.url)
  }, [])

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

  const handleAutoSyncTimingChange = useCallback(
    (value: string) => {
      setAutoSyncTiming(value as AutoSyncTiming)
    },
    [setAutoSyncTiming]
  )

  const hasChangesToSync = useMemo(() => {
    const expenseChanges =
      state.pendingChanges.added +
      state.pendingChanges.edited +
      state.pendingChanges.deleted
    const settingsChanges = settings.syncSettings && hasUnsyncedSettingsChanges ? 1 : 0
    return expenseChanges + settingsChanges > 0
  }, [state.pendingChanges, settings.syncSettings, hasUnsyncedSettingsChanges])

  const handleSync = useCallback(() => {
    smartSyncMutation.mutate(
      {
        expenses: state.expenses,
        settings: settings.syncSettings ? settings : undefined,
        syncSettingsEnabled: settings.syncSettings,
        hasLocalChanges: hasChangesToSync,
      },
      {
        onSuccess: (result) => {
          switch (result.action) {
            case "in_sync":
              addNotification("Already in sync - no changes needed", "success")
              break

            case "push":
              addNotification(result.message, "success")
              clearPendingChangesAfterSync()
              if (settings.syncSettings && result.result?.settingsSynced) {
                clearSettingsChangeFlag()
              }
              break

            case "pull":
              if (result.downloadResult?.settings) {
                replaceSettings(result.downloadResult.settings)
              }
              addNotification(result.message, "success")
              break

            case "conflict":
              Alert.alert(
                "Sync Conflict",
                "Both local and remote have changes since last sync. How would you like to proceed?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Upload Local",
                    onPress: () => handlePush(),
                  },
                  {
                    text: "Download Remote",
                    onPress: () => handlePull(),
                  },
                ]
              )
              break
          }
        },
        onError: (error) => {
          addNotification(String(error), "error")
        },
      }
    )
  }, [
    smartSyncMutation,
    state.expenses,
    settings,
    hasChangesToSync,
    addNotification,
    clearPendingChangesAfterSync,
    clearSettingsChangeFlag,
    replaceSettings,
    handlePush,
    handlePull,
  ])

  return (
    <ScreenContainer>
      <YStack gap="$4" style={layoutStyles.container}>
        {/* APPEARANCE Section */}
        <SettingsSection title="APPEARANCE">
          <YStack gap="$2">
            <Label>Theme</Label>
            <ThemeSelector value={settings.theme} onChange={handleThemeChange} />
          </YStack>
        </SettingsSection>

        {/* DEFAULT PAYMENT METHOD Section */}
        <SettingsSection title="DEFAULT PAYMENT METHOD">
          <YStack gap="$2">
            <Text color="$color" opacity={0.7} fontSize="$3">
              Pre-select this payment method when adding new expenses.
            </Text>
            <DefaultPaymentMethodSelector
              value={settings.defaultPaymentMethod}
              onChange={handleDefaultPaymentMethodChange}
            />
          </YStack>
        </SettingsSection>

        {/* GITHUB SYNC Section */}
        <SettingsSection title="GITHUB SYNC">
          <Text color="$color" opacity={0.7} fontSize="$3">
            Sync your expenses to a GitHub repository using a Personal Access Token.
          </Text>

          {/* Collapsible GitHub Configuration */}
          <Accordion type="single" collapsible defaultValue={undefined}>
            <Accordion.Item value="github-config">
              <Accordion.Trigger
                bg="$backgroundHover"
                style={layoutStyles.accordionTrigger}
              >
                {({ open }: { open: boolean }) => (
                  <>
                    <XStack style={layoutStyles.accordionTriggerInner}>
                      <Text fontWeight="500">GitHub Configuration</Text>
                      {isConfigured && (
                        <XStack style={layoutStyles.connectedBadge}>
                          <Check size={14} color={successColor} />
                          <Text fontSize="$2" color={successColor}>
                            Connected
                          </Text>
                        </XStack>
                      )}
                    </XStack>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: [{ rotate: open ? "180deg" : "0deg" }],
                      }}
                    />
                  </>
                )}
              </Accordion.Trigger>
              <Accordion.Content style={layoutStyles.accordionContent}>
                <YStack gap="$3">
                  {/* GitHub PAT */}
                  <YStack gap="$2">
                    <Label>GitHub Personal Access Token</Label>
                    <Input
                      secureTextEntry
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={token}
                      onChangeText={(text) => {
                        setToken(text)
                        // Clear error when user starts typing
                        if (configErrors.token) {
                          setConfigErrors((prev) => {
                            const { token: _, ...rest } = prev
                            return rest
                          })
                        }
                      }}
                      size="$4"
                      borderWidth={2}
                      borderColor={configErrors.token ? "$red10" : "$borderColor"}
                    />
                    {configErrors.token ? (
                      <Text fontSize="$2" color="$red10">
                        {configErrors.token}
                      </Text>
                    ) : (
                      <Text fontSize="$2" color="$color" opacity={0.6}>
                        Create a fine-grained PAT with Contents (read/write) permission
                      </Text>
                    )}
                  </YStack>

                  {/* Repository */}
                  <YStack gap="$2">
                    <Label>Repository</Label>
                    <Input
                      placeholder="username/repo-name"
                      value={repo}
                      onChangeText={(text) => {
                        setRepo(text)
                        // Clear error when user starts typing
                        if (configErrors.repo) {
                          setConfigErrors((prev) => {
                            const { repo: _, ...rest } = prev
                            return rest
                          })
                        }
                      }}
                      size="$4"
                      borderWidth={2}
                      borderColor={configErrors.repo ? "$red10" : "$borderColor"}
                    />
                    {configErrors.repo && (
                      <Text fontSize="$2" color="$red10">
                        {configErrors.repo}
                      </Text>
                    )}
                  </YStack>

                  {/* Branch */}
                  <YStack gap="$2">
                    <Label>Branch</Label>
                    <Input
                      placeholder="main"
                      value={branch}
                      onChangeText={(text) => {
                        setBranch(text)
                        // Clear error when user starts typing
                        if (configErrors.branch) {
                          setConfigErrors((prev) => {
                            const { branch: _, ...rest } = prev
                            return rest
                          })
                        }
                      }}
                      size="$4"
                      borderWidth={2}
                      borderColor={configErrors.branch ? "$red10" : "$borderColor"}
                    />
                    {configErrors.branch && (
                      <Text fontSize="$2" color="$red10">
                        {configErrors.branch}
                      </Text>
                    )}
                  </YStack>

                  {/* Action Buttons */}
                  <XStack gap="$3" style={layoutStyles.buttonRow}>
                    <Button flex={1} size="$4" onPress={handleSaveConfig} themeInverse>
                      Save Config
                    </Button>
                    <Button
                      flex={1}
                      size="$4"
                      onPress={handleTestConnection}
                      disabled={isTesting || !token || !repo}
                      icon={
                        connectionStatus === "success"
                          ? Check
                          : connectionStatus === "error"
                            ? X
                            : undefined
                      }
                      style={{
                        backgroundColor:
                          connectionStatus === "success"
                            ? successColor
                            : connectionStatus === "error"
                              ? errorColor
                              : primaryColor,
                      }}
                      color={connectionStatus === "idle" ? undefined : "white"}
                    >
                      {isTesting ? "Testing..." : "Test"}
                    </Button>
                  </XStack>

                  {/* Clear Configuration Button */}
                  {isConfigured && (
                    <Button
                      size="$3"
                      color="white"
                      onPress={handleClearConfig}
                      icon={X}
                      style={{ marginTop: 12, backgroundColor: errorColor }}
                    >
                      Clear Configuration
                    </Button>
                  )}
                </YStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>

          {/* Sync Button - only shown when configured */}
          {isConfigured && (
            <YStack gap="$4" style={layoutStyles.syncButtonsContainer}>
              <Button size="$4" onPress={handleSync} disabled={isSyncing} themeInverse>
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>

              {/* Auto Sync Settings - grouped here as requested */}
              <YStack
                gap="$3"
                borderTopWidth={1}
                borderTopColor="$borderColor"
                style={{ paddingTop: 16 }}
              >
                <Text fontSize="$4" fontWeight="600">
                  Auto-Sync & Options
                </Text>

                {/* Enable Auto-Sync Toggle */}
                <XStack style={layoutStyles.autoSyncRow}>
                  <YStack flex={1}>
                    <Label>Enable Auto-Sync</Label>
                    <Text
                      fontSize="$2"
                      color="$color"
                      opacity={0.6}
                      style={layoutStyles.helperText}
                    >
                      Automatically sync with GitHub when configured
                    </Text>
                  </YStack>
                  <Switch
                    size="$4"
                    checked={settings.autoSyncEnabled}
                    onCheckedChange={setAutoSyncEnabled}
                    backgroundColor={
                      settings.autoSyncEnabled
                        ? SEMANTIC_COLORS.success
                        : ("$gray8" as any)
                    }
                  >
                    <Switch.Thumb />
                  </Switch>
                </XStack>

                {/* Also sync settings toggle */}
                <XStack style={layoutStyles.autoSyncRow}>
                  <YStack flex={1}>
                    <Label>Also sync settings</Label>
                    <Text
                      fontSize="$2"
                      color="$color"
                      opacity={0.6}
                      style={layoutStyles.helperText}
                    >
                      Include theme and preferences in sync
                    </Text>
                  </YStack>
                  <Switch
                    size="$4"
                    checked={settings.syncSettings}
                    onCheckedChange={handleSyncSettingsToggle}
                    backgroundColor={
                      settings.syncSettings ? SEMANTIC_COLORS.success : ("$gray8" as any)
                    }
                  >
                    <Switch.Thumb />
                  </Switch>
                </XStack>

                {/* When to Sync */}
                {settings.autoSyncEnabled && (
                  <YStack gap="$2" style={{ marginTop: 8 }}>
                    <Label>When to Sync</Label>
                    <RadioGroup
                      value={settings.autoSyncTiming}
                      onValueChange={handleAutoSyncTimingChange}
                    >
                      <XStack gap="$2" style={layoutStyles.radioRow}>
                        <RadioGroup.Item value="on_launch" id="on_launch" size="$4">
                          <RadioGroup.Indicator />
                        </RadioGroup.Item>
                        <YStack flex={1}>
                          <Label htmlFor="on_launch">On App Launch</Label>
                          <Text fontSize="$2" color="$color" opacity={0.6}>
                            Sync when the app starts
                          </Text>
                        </YStack>
                      </XStack>

                      <XStack gap="$2" style={layoutStyles.radioRow}>
                        <RadioGroup.Item value="on_change" id="on_change" size="$4">
                          <RadioGroup.Indicator />
                        </RadioGroup.Item>
                        <YStack flex={1}>
                          <Label htmlFor="on_change">On Every Change</Label>
                          <Text fontSize="$2" color="$color" opacity={0.6}>
                            Sync immediately after making changes
                          </Text>
                        </YStack>
                      </XStack>
                    </RadioGroup>
                  </YStack>
                )}
              </YStack>
            </YStack>
          )}
        </SettingsSection>

        {/* APP INFORMATION Section */}
        <SettingsSection title="APP INFORMATION">
          <YStack gap="$3">
            {/* Current Version */}
            <XStack style={layoutStyles.versionRow}>
              <Text color="$color" opacity={0.8}>
                Current Version
              </Text>
              <Text fontWeight="bold">v{APP_CONFIG.version}</Text>
            </XStack>

            {/* Update Info */}
            {updateInfo && !updateInfo.error && (
              <XStack style={layoutStyles.versionRow}>
                <Text color="$color" opacity={0.8}>
                  Latest Version
                </Text>
                <Text
                  fontWeight="bold"
                  color={updateInfo.hasUpdate ? successColor : "$color"}
                  opacity={updateInfo.hasUpdate ? 1 : 0.8}
                >
                  v{updateInfo.latestVersion}
                </Text>
              </XStack>
            )}

            {/* Check for Updates Button */}
            <Button
              size="$4"
              onPress={handleCheckForUpdates}
              disabled={isCheckingUpdate}
              icon={Download}
            >
              {isCheckingUpdate ? "Checking..." : "Check for Updates"}
            </Button>

            {/* Update Available - Open Release */}
            {updateInfo?.hasUpdate && (
              <Button
                size="$4"
                themeInverse
                onPress={handleOpenRelease}
                icon={ExternalLink}
              >
                Download v{updateInfo.latestVersion}
              </Button>
            )}

            {/* GitHub Link */}
            <Button size="$3" chromeless onPress={handleOpenGitHub} icon={ExternalLink}>
              View on GitHub
            </Button>
          </YStack>
        </SettingsSection>
      </YStack>
    </ScreenContainer>
  )
}
