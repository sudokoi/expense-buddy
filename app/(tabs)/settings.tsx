import { useState, useEffect } from "react"
import {
  YStack,
  XStack,
  Text,
  Input,
  Button,
  Label,
  Card,
  Switch,
  RadioGroup,
  useTheme,
} from "tamagui"
import { Alert, Linking, ViewStyle } from "react-native"
import { Check, X, Download, ExternalLink } from "@tamagui/lucide-icons"
import {
  saveSyncConfig,
  loadSyncConfig,
  clearSyncConfig,
  testConnection,
  syncUp,
  syncDown,
  SyncConfig,
  saveAutoSyncSettings,
  loadAutoSyncSettings,
  AutoSyncTiming,
  analyzeConflicts,
  smartMerge,
} from "../../services/sync-manager"
import { Expense } from "../../types/expense"
import {
  getPendingChangesCount,
  clearPendingChanges,
} from "../../services/change-tracker"
import { useExpenses } from "../../context/ExpenseContext"
import { useNotifications } from "../../context/notification-context"
import { useSyncStatus } from "../../context/sync-status-context"
import { checkForUpdates, UpdateInfo } from "../../services/update-checker"
import { APP_CONFIG } from "../../constants/app-config"
import { ScreenContainer, SectionHeader } from "../../components/ui"

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
  descriptionText: {
    marginBottom: 16,
  },
  helperText: {
    marginTop: 4,
  },
  clearButton: {
    marginTop: 16,
  } as ViewStyle,
}

export default function SettingsScreen() {
  const theme = useTheme()
  const { state, replaceAllExpenses, clearPendingChangesAfterSync } = useExpenses()
  const { addNotification } = useNotifications()
  const { startSync, endSync } = useSyncStatus()

  // Theme colors for components that need raw values due to Tamagui type constraints
  const gray9Color = theme.gray9?.val as string
  const gray10Color = theme.gray10?.val as string
  const gray11Color = theme.gray11?.val as string
  const green10Color = theme.green10?.val as string
  const red10Color = theme.red10?.val as string
  const blue10Color = theme.blue10?.val as string

  const [token, setToken] = useState("")
  const [repo, setRepo] = useState("")
  const [branch, setBranch] = useState("main")
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">(
    "idle"
  )

  // Auto-sync settings
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [autoSyncTiming, setAutoSyncTiming] = useState<AutoSyncTiming>("on_launch")

  // Update check state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  // Pending sync count state
  const [pendingChangesCount, setPendingChangesCount] = useState<{
    added: number
    edited: number
    deleted: number
    total: number
  } | null>(null)
  const [isComputingSyncCount, setIsComputingSyncCount] = useState(false)

  useEffect(() => {
    loadConfig()
    loadAutoSync()
  }, [])

  // Compute pending changes count when expenses change
  useEffect(() => {
    const computeChangesCount = async () => {
      setIsComputingSyncCount(true)
      try {
        const result = await getPendingChangesCount()
        setPendingChangesCount(result)
      } catch (error) {
        console.warn("Failed to compute changes count:", error)
        setPendingChangesCount(null)
      } finally {
        setIsComputingSyncCount(false)
      }
    }

    computeChangesCount()
  }, [state.expenses])

  const loadConfig = async () => {
    const config = await loadSyncConfig()
    if (config) {
      setToken(config.token)
      setRepo(config.repo)
      setBranch(config.branch)
    }
  }

  const loadAutoSync = async () => {
    const settings = await loadAutoSyncSettings()
    setAutoSyncEnabled(settings.enabled)
    setAutoSyncTiming(settings.timing)
  }

  const handleSaveAutoSync = async () => {
    await saveAutoSyncSettings({
      enabled: autoSyncEnabled,
      timing: autoSyncTiming,
    })
    addNotification("Auto-sync settings saved", "success")
  }

  const handleSaveConfig = async () => {
    if (!token || !repo || !branch) {
      addNotification("Please fill in all fields", "error")
      return
    }

    // Check if this is first-time configuration (no previous config existed)
    const previousConfig = await loadSyncConfig()
    const isFirstTimeSetup = !previousConfig

    const config: SyncConfig = { token, repo, branch }
    await saveSyncConfig(config)
    addNotification("Sync configuration saved", "success")

    // Only prompt to download if this is first-time setup AND no local expenses
    // This avoids prompting when user has deleted all data intentionally
    if (isFirstTimeSetup && state.expenses.length === 0) {
      // Prompt user to download existing data from GitHub
      Alert.alert(
        "Download Existing Data?",
        "Would you like to download your expenses from GitHub now?",
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Download",
            onPress: async () => {
              setIsSyncing(true)
              startSync()
              const result = await syncDown()
              setIsSyncing(false)
              endSync(result.success)

              if (result.success && result.expenses) {
                replaceAllExpenses(result.expenses)
                addNotification(
                  `Downloaded ${result.expenses.length} expenses`,
                  "success"
                )

                // Auto-enable sync for convenience
                if (!autoSyncEnabled) {
                  setAutoSyncEnabled(true)
                  await saveAutoSyncSettings({
                    enabled: true,
                    timing: autoSyncTiming,
                  })
                  addNotification("Auto-sync enabled", "info")
                }
              } else {
                addNotification(result.error || result.message, "error")
              }
            },
          },
        ]
      )
    }
  }

  const handleTestConnection = async () => {
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
  }

  const handleSyncUp = async () => {
    setIsSyncing(true)
    startSync()
    const result = await syncUp(state.expenses)
    setIsSyncing(false)
    endSync(result.success)

    if (result.success) {
      addNotification(result.message, "success")
      // Clear pending changes after successful sync
      await clearPendingChangesAfterSync()
      // Refresh pending changes count
      const changesCount = await getPendingChangesCount()
      setPendingChangesCount(changesCount)
    } else {
      addNotification(result.error || result.message, "error")
    }
  }

  const handleSyncDown = async () => {
    setIsSyncing(true)
    startSync()

    // First, analyze what conflicts exist
    const analysis = await analyzeConflicts(state.expenses)

    setIsSyncing(false)
    endSync(analysis.success)

    if (!analysis.success) {
      addNotification(analysis.error || "Failed to analyze conflicts", "error")
      return
    }

    const conflicts = analysis.conflicts!
    const remoteExpenses = analysis.remoteExpenses!

    // Check if there are any changes at all
    const hasRemoteUpdates = conflicts.remoteWins > 0
    const hasNewFromRemote = conflicts.newFromRemote > 0
    const hasLocalOnly = conflicts.newFromLocal > 0
    const hasDeletedLocally = conflicts.deletedLocally > 0

    // Build a summary message
    const summaryParts: string[] = []
    if (conflicts.newFromRemote > 0)
      summaryParts.push(`${conflicts.newFromRemote} new from GitHub`)
    if (conflicts.remoteWins > 0)
      summaryParts.push(`${conflicts.remoteWins} updated from GitHub`)
    if (conflicts.localWins > 0)
      summaryParts.push(`${conflicts.localWins} local changes kept`)
    if (conflicts.newFromLocal > 0)
      summaryParts.push(`${conflicts.newFromLocal} local-only kept`)
    if (conflicts.deletedLocally > 0)
      summaryParts.push(`${conflicts.deletedLocally} deleted locally`)

    const summary = summaryParts.length > 0 ? summaryParts.join(", ") : "No changes"

    // If no changes at all, inform the user
    if (
      !hasRemoteUpdates &&
      !hasNewFromRemote &&
      !hasLocalOnly &&
      !hasDeletedLocally &&
      conflicts.localWins === 0
    ) {
      addNotification("Already in sync - no changes needed", "success")
      return
    }

    // If remote has newer versions that will overwrite local edits, ask for confirmation
    if (hasRemoteUpdates) {
      Alert.alert(
        "Merge Conflicts Detected",
        `${conflicts.remoteWins} record(s) on GitHub are newer than your local version and will overwrite them.\n\nSummary: ${summary}\n\nProceed with merge?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Merge",
            onPress: () => performSmartMerge(remoteExpenses, summary),
          },
        ]
      )
    } else {
      // No conflicts - just merge automatically
      await performSmartMerge(remoteExpenses, summary)
    }
  }

  const performSmartMerge = async (remoteExpenses: Expense[], summary: string) => {
    setIsSyncing(true)
    startSync()

    try {
      const mergeResult = await smartMerge(state.expenses, remoteExpenses)

      // Update local state with merged data
      replaceAllExpenses(mergeResult.merged)

      // Clear pending changes since we've merged
      await clearPendingChanges()
      const changesCount = await getPendingChangesCount()
      setPendingChangesCount(changesCount)

      setIsSyncing(false)
      endSync(true)

      addNotification(`Merged successfully: ${summary}`, "success")
    } catch (error) {
      setIsSyncing(false)
      endSync(false)
      addNotification(`Merge failed: ${String(error)}`, "error")
    }
  }

  const handleClearConfig = async () => {
    Alert.alert("Confirm Clear", "Remove sync configuration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearSyncConfig()
          setToken("")
          setRepo("")
          setBranch("main")
          setConnectionStatus("idle")
          addNotification("Configuration cleared", "success")
        },
      },
    ])
  }

  const handleCheckForUpdates = async () => {
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
  }

  const handleOpenRelease = () => {
    if (updateInfo?.releaseUrl) {
      Linking.openURL(updateInfo.releaseUrl)
    }
  }

  return (
    <ScreenContainer>
      <YStack gap="$4" style={layoutStyles.container}>
        <SectionHeader>GitHub Sync Settings</SectionHeader>

        <Text color={gray10Color as any} style={layoutStyles.descriptionText as any}>
          Sync your expenses to a GitHub repository using a Personal Access Token.
        </Text>

        {/* GitHub PAT */}
        <YStack gap="$2">
          <Label>GitHub Personal Access Token</Label>
          <Input
            secureTextEntry
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChangeText={setToken}
            size="$4"
            borderWidth={2}
            borderColor="$borderColor"
          />
          <Text fontSize="$2" color={gray9Color as any}>
            Create a fine-grained PAT with Contents (read/write) permission
          </Text>
        </YStack>

        {/* Repository */}
        <YStack gap="$2">
          <Label>Repository</Label>
          <Input
            placeholder="username/repo-name"
            value={repo}
            onChangeText={setRepo}
            size="$4"
            borderWidth={2}
            borderColor="$borderColor"
          />
        </YStack>

        {/* Branch */}
        <YStack gap="$2">
          <Label>Branch</Label>
          <Input
            placeholder="main"
            value={branch}
            onChangeText={setBranch}
            size="$4"
            borderWidth={2}
            borderColor="$borderColor"
          />
        </YStack>

        {/* Action Buttons */}
        <XStack gap="$3" style={layoutStyles.buttonRow}>
          <Button flex={1} size="$4" onPress={handleSaveConfig} themeInverse>
            Save Configuration
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
                  ? green10Color
                  : connectionStatus === "error"
                    ? red10Color
                    : blue10Color,
            }}
            color={connectionStatus === "idle" ? undefined : "white"}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
        </XStack>

        {/* Sync Actions */}
        <Card bordered padding="$4" marginTop="$4">
          <SectionHeader>Manual Sync</SectionHeader>

          <YStack gap="$3">
            <Button
              size="$4"
              onPress={handleSyncUp}
              disabled={isSyncing || !token || !repo}
            >
              {isSyncing
                ? "Syncing..."
                : isComputingSyncCount
                  ? "Checking changes..."
                  : pendingChangesCount === null
                    ? `Upload to GitHub (${state.expenses.length} expenses)`
                    : pendingChangesCount.total === 0
                      ? "No changes to sync"
                      : `Upload to GitHub (${pendingChangesCount.total} record(s) changed)`}
            </Button>

            <Button
              size="$4"
              onPress={handleSyncDown}
              disabled={isSyncing || !token || !repo}
            >
              Sync from GitHub
            </Button>
          </YStack>
        </Card>

        {/* Auto-Sync Settings */}
        <Card bordered padding="$4" marginTop="$4">
          <SectionHeader>Auto-Sync Settings</SectionHeader>

          <YStack gap="$3">
            {/* Enable Auto-Sync Toggle */}
            <XStack style={layoutStyles.autoSyncRow}>
              <YStack flex={1}>
                <Label>Enable Auto-Sync</Label>
                <Text
                  fontSize="$2"
                  color={gray9Color as any}
                  style={layoutStyles.helperText as any}
                >
                  Automatically sync with GitHub when configured
                </Text>
              </YStack>
              <Switch
                size="$4"
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
              >
                <Switch.Thumb animation="quick" />
              </Switch>
            </XStack>

            {/* When to Sync */}
            {autoSyncEnabled && (
              <YStack gap="$2">
                <Label>When to Sync</Label>
                <RadioGroup
                  value={autoSyncTiming}
                  onValueChange={(value) => setAutoSyncTiming(value as AutoSyncTiming)}
                >
                  <XStack gap="$2" style={layoutStyles.radioRow}>
                    <RadioGroup.Item value="on_launch" id="on_launch" size="$4">
                      <RadioGroup.Indicator />
                    </RadioGroup.Item>
                    <Label htmlFor="on_launch" flex={1}>
                      On App Launch
                      <Text
                        fontSize="$2"
                        color={gray9Color as any}
                        style={layoutStyles.helperText as any}
                      >
                        Sync when the app starts
                      </Text>
                    </Label>
                  </XStack>

                  <XStack gap="$2" style={layoutStyles.radioRow}>
                    <RadioGroup.Item value="on_change" id="on_change" size="$4">
                      <RadioGroup.Indicator />
                    </RadioGroup.Item>
                    <Label htmlFor="on_change" flex={1}>
                      On Every Change
                      <Text
                        fontSize="$2"
                        color={gray9Color as any}
                        style={layoutStyles.helperText as any}
                      >
                        Sync after adding, editing, or deleting expenses
                      </Text>
                    </Label>
                  </XStack>
                </RadioGroup>
              </YStack>
            )}

            {/* Save Auto-Sync Button */}
            <Button size="$4" onPress={handleSaveAutoSync} themeInverse>
              Save Auto-Sync Settings
            </Button>
          </YStack>
        </Card>

        {/* App Info & Updates */}
        <Card bordered padding="$4" marginTop="$4">
          <SectionHeader>App Information</SectionHeader>

          <YStack gap="$3">
            {/* Current Version */}
            <XStack style={layoutStyles.versionRow}>
              <Text color={gray11Color as any}>Current Version</Text>
              <Text fontWeight="bold">v{APP_CONFIG.version}</Text>
            </XStack>

            {/* Update Info */}
            {updateInfo && !updateInfo.error && (
              <XStack style={layoutStyles.versionRow}>
                <Text color={gray11Color as any}>Latest Version</Text>
                <Text
                  fontWeight="bold"
                  color={
                    updateInfo.hasUpdate ? (green10Color as any) : (gray11Color as any)
                  }
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
            <Button
              size="$3"
              chromeless
              onPress={() => Linking.openURL(APP_CONFIG.github.url)}
              icon={ExternalLink}
            >
              View on GitHub
            </Button>
          </YStack>
        </Card>

        {/* Clear Config */}
        <Button
          size="$3"
          chromeless
          color={red10Color as any}
          onPress={handleClearConfig}
          style={layoutStyles.clearButton}
        >
          Clear Configuration
        </Button>
      </YStack>
    </ScreenContainer>
  )
}
