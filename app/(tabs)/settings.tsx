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
import { testConnection, SyncConfig, syncDown } from "../../services/sync-manager"
import { validateGitHubConfig } from "../../utils/github-config-validation"
import { AutoSyncTiming } from "../../services/settings-manager"
import { PaymentMethodType } from "../../types/expense"
import { useExpenses, useNotifications, useSettings } from "../../stores"
import {
  useSyncMachine,
  TrueConflict,
  ConflictResolution,
} from "../../hooks/use-sync-machine"

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

  // XState sync machine for the main sync flow
  const syncMachine = useSyncMachine()
  const isSyncing = syncMachine.isSyncing

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
            onPress: async () => {
              try {
                const result = await syncDown(7, settings.syncSettings)
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
              } catch (error) {
                addNotification(String(error), "error")
              }
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
        // For simplicity, show a dialog with options to keep all local or all remote
        // A more advanced UI could show each conflict individually
        const conflictCount = conflicts.length
        const conflictSummary = conflicts
          .slice(0, 3)
          .map((c) => {
            const localNote = c.localVersion.note || "Unnamed"
            const remoteNote = c.remoteVersion.note || "Unnamed"
            const localAmount = `$${c.localVersion.amount}`
            const remoteAmount = `$${c.remoteVersion.amount}`

            // Show both versions side by side
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
        onConflict: async (conflicts: TrueConflict[]) => {
          // Show conflict resolution dialog
          const resolutions = await showConflictDialog(conflicts)
          if (resolutions) {
            // User chose to resolve - send resolutions to state machine
            syncMachine.resolveConflicts(resolutions)
          } else {
            // User cancelled
            syncMachine.cancel()
          }
        },
        onSuccess: (result) => {
          // Build success message from merge result (Requirements 7.1, 7.2, 7.3, 7.4)
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
            // Include auto-resolved conflicts count (Requirement 7.4)
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

          // Update local expenses with merged result if available
          if (result.mergeResult && result.mergeResult.merged.length > 0) {
            replaceAllExpenses(result.mergeResult.merged)
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
    clearPendingChangesAfterSync,
    clearSettingsChangeFlag,
    replaceAllExpenses,
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
                {syncButtonText}
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
