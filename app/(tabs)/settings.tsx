import React, { useState, useEffect } from "react";
import {
  YStack,
  XStack,
  Text,
  Input,
  Button,
  H4,
  Label,
  ScrollView,
  useTheme,
  Card,
  Switch,
  RadioGroup,
} from "tamagui";
import { Alert, Linking } from "react-native";
import { Check, X, Download, ExternalLink } from "@tamagui/lucide-icons";
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
  getPendingSyncCount,
} from "../../services/sync-manager";
import { useExpenses } from "../../context/ExpenseContext";
import { useNotifications } from "../../context/notification-context";
import { useSyncStatus } from "../../context/sync-status-context";
import { checkForUpdates, UpdateInfo } from "../../services/update-checker";
import { APP_CONFIG } from "../../constants/app-config";

export default function SettingsScreen() {
  const theme = useTheme();
  const { state, replaceAllExpenses } = useExpenses();
  const { addNotification } = useNotifications();
  const { startSync, endSync } = useSyncStatus();

  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  // Auto-sync settings
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncTiming, setAutoSyncTiming] =
    useState<AutoSyncTiming>("on_launch");

  // Update check state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Pending sync count state
  const [pendingSyncCount, setPendingSyncCount] = useState<{
    filesChanged: number;
    filesToDelete: number;
  } | null>(null);
  const [isComputingSyncCount, setIsComputingSyncCount] = useState(false);

  useEffect(() => {
    loadConfig();
    loadAutoSync();
  }, []);

  // Compute pending sync count when expenses change
  useEffect(() => {
    const computeSyncCount = async () => {
      setIsComputingSyncCount(true);
      try {
        const result = await getPendingSyncCount(state.expenses);
        setPendingSyncCount({
          filesChanged: result.filesChanged,
          filesToDelete: result.filesToDelete,
        });
      } catch (error) {
        console.warn("Failed to compute sync count:", error);
        setPendingSyncCount(null);
      } finally {
        setIsComputingSyncCount(false);
      }
    };

    computeSyncCount();
  }, [state.expenses]);

  const loadConfig = async () => {
    const config = await loadSyncConfig();
    if (config) {
      setToken(config.token);
      setRepo(config.repo);
      setBranch(config.branch);
    }
  };

  const loadAutoSync = async () => {
    const settings = await loadAutoSyncSettings();
    setAutoSyncEnabled(settings.enabled);
    setAutoSyncTiming(settings.timing);
  };

  const handleSaveAutoSync = async () => {
    await saveAutoSyncSettings({
      enabled: autoSyncEnabled,
      timing: autoSyncTiming,
    });
    addNotification("Auto-sync settings saved", "success");
  };

  const handleSaveConfig = async () => {
    if (!token || !repo || !branch) {
      addNotification("Please fill in all fields", "error");
      return;
    }

    // Check if this is first-time configuration (no previous config existed)
    const previousConfig = await loadSyncConfig();
    const isFirstTimeSetup = !previousConfig;

    const config: SyncConfig = { token, repo, branch };
    await saveSyncConfig(config);
    addNotification("Sync configuration saved", "success");

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
              setIsSyncing(true);
              startSync();
              const result = await syncDown();
              setIsSyncing(false);
              endSync(result.success);

              if (result.success && result.expenses) {
                replaceAllExpenses(result.expenses);
                addNotification(
                  `Downloaded ${result.expenses.length} expenses`,
                  "success"
                );

                // Auto-enable sync for convenience
                if (!autoSyncEnabled) {
                  setAutoSyncEnabled(true);
                  await saveAutoSyncSettings({
                    enabled: true,
                    timing: autoSyncTiming,
                  });
                  addNotification("Auto-sync enabled", "info");
                }
              } else {
                addNotification(result.error || result.message, "error");
              }
            },
          },
        ]
      );
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("idle");

    const result = await testConnection();

    setIsTesting(false);
    if (result.success) {
      setConnectionStatus("success");
      addNotification(result.message, "success");
    } else {
      setConnectionStatus("error");
      addNotification(result.error || result.message, "error");
    }
  };

  const handleSyncUp = async () => {
    setIsSyncing(true);
    startSync();
    const result = await syncUp(state.expenses);
    setIsSyncing(false);
    endSync(result.success);

    if (result.success) {
      addNotification(result.message, "success");
      // Refresh pending sync count after successful sync
      const syncCount = await getPendingSyncCount(state.expenses);
      setPendingSyncCount({
        filesChanged: syncCount.filesChanged,
        filesToDelete: syncCount.filesToDelete,
      });
    } else {
      addNotification(result.error || result.message, "error");
    }
  };

  const handleSyncDown = async () => {
    Alert.alert(
      "Confirm Download",
      "This will replace your local data with data from GitHub. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          style: "destructive",
          onPress: async () => {
            setIsSyncing(true);
            startSync();
            const result = await syncDown();
            setIsSyncing(false);
            endSync(result.success);

            if (result.success && result.expenses) {
              // Update the app state with downloaded expenses
              replaceAllExpenses(result.expenses);
              const moreInfo = result.hasMore
                ? " (Load more from History tab)"
                : "";
              addNotification(
                `Downloaded ${result.expenses.length} expenses${moreInfo}`,
                "success"
              );
            } else {
              addNotification(result.error || result.message, "error");
            }
          },
        },
      ]
    );
  };

  const handleClearConfig = async () => {
    Alert.alert("Confirm Clear", "Remove sync configuration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearSyncConfig();
          setToken("");
          setRepo("");
          setBranch("main");
          setConnectionStatus("idle");
          addNotification("Configuration cleared", "success");
        },
      },
    ]);
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    const info = await checkForUpdates();
    setUpdateInfo(info);
    setIsCheckingUpdate(false);

    if (info.error) {
      addNotification(info.error, "error");
    } else if (info.hasUpdate) {
      addNotification(`Update available: v${info.latestVersion}`, "success");
    } else {
      addNotification("You're on the latest version", "success");
    }
  };

  const handleOpenRelease = () => {
    if (updateInfo?.releaseUrl) {
      Linking.openURL(updateInfo.releaseUrl);
    }
  };

  return (
    <ScrollView
      flex={1}
      style={{ backgroundColor: theme.background.val as string }}
      contentContainerStyle={{ padding: 20 } as any}
    >
      <YStack
        space="$4"
        style={{ maxWidth: 600, alignSelf: "center", width: "100%" }}
      >
        <H4 style={{ marginBottom: 8 }}>GitHub Sync Settings</H4>

        <Text
          style={{
            color: (theme.gray10?.val as string) || "gray",
            marginBottom: 16,
          }}
        >
          Sync your expenses to a GitHub repository using a Personal Access
          Token.
        </Text>

        {/* GitHub PAT */}
        <YStack space="$2">
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
          <Text
            style={{
              fontSize: 12,
              color: (theme.gray9?.val as string) || "gray",
            }}
          >
            Create a fine-grained PAT with Contents (read/write) permission
          </Text>
        </YStack>

        {/* Repository */}
        <YStack space="$2">
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
        <YStack space="$2">
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
        <XStack style={{ gap: 12, flexWrap: "wrap" }}>
          <Button
            flex={1}
            style={{ minWidth: "45%" }}
            size="$4"
            onPress={handleSaveConfig}
            themeInverse
          >
            Save Configuration
          </Button>
          <Button
            flex={1}
            style={{
              minWidth: "45%",
              backgroundColor:
                connectionStatus === "success"
                  ? "#22c55e" // Bright green
                  : connectionStatus === "error"
                  ? "#ef4444" // Bright red
                  : "#3b82f6", // Default blue
            }}
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
            color={connectionStatus === "idle" ? undefined : "white"}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
        </XStack>

        {/* Sync Actions */}
        <Card bordered style={{ padding: 16, marginTop: 16 }}>
          <H4 style={{ marginBottom: 12, fontSize: 16 }}>Manual Sync</H4>

          <YStack space="$3">
            <Button
              size="$4"
              onPress={handleSyncUp}
              disabled={isSyncing || !token || !repo}
            >
              {isSyncing
                ? "Syncing..."
                : isComputingSyncCount
                ? "Checking changes..."
                : pendingSyncCount === null
                ? `Upload to GitHub (${state.expenses.length} expenses)`
                : pendingSyncCount.filesChanged +
                    pendingSyncCount.filesToDelete ===
                  0
                ? "No changes to sync"
                : `Upload to GitHub (${
                    pendingSyncCount.filesChanged +
                    pendingSyncCount.filesToDelete
                  } file(s) changed)`}
            </Button>

            <Button
              size="$4"
              onPress={handleSyncDown}
              disabled={isSyncing || !token || !repo}
            >
              Download from GitHub
            </Button>
          </YStack>
        </Card>

        {/* Auto-Sync Settings */}
        <Card bordered style={{ padding: 16, marginTop: 16 }}>
          <H4 style={{ marginBottom: 12, fontSize: 16 }}>Auto-Sync Settings</H4>

          <YStack space="$3">
            {/* Enable Auto-Sync Toggle */}
            <XStack
              style={
                { alignItems: "center", justifyContent: "space-between" } as any
              }
            >
              <YStack flex={1}>
                <Label>Enable Auto-Sync</Label>
                <Text
                  style={{
                    fontSize: 12,
                    color: (theme.gray9?.val as string) || "gray",
                    marginTop: 4,
                  }}
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
                  onValueChange={(value) =>
                    setAutoSyncTiming(value as AutoSyncTiming)
                  }
                >
                  <XStack
                    style={
                      { alignItems: "center", gap: 8, marginVertical: 8 } as any
                    }
                  >
                    <RadioGroup.Item value="on_launch" id="on_launch" size="$4">
                      <RadioGroup.Indicator />
                    </RadioGroup.Item>
                    <Label htmlFor="on_launch" flex={1}>
                      On App Launch
                      <Text
                        style={{
                          fontSize: 12,
                          color: (theme.gray9?.val as string) || "gray",
                          marginTop: 4,
                        }}
                      >
                        Sync when the app starts
                      </Text>
                    </Label>
                  </XStack>

                  <XStack
                    style={
                      { alignItems: "center", gap: 8, marginVertical: 8 } as any
                    }
                  >
                    <RadioGroup.Item value="on_change" id="on_change" size="$4">
                      <RadioGroup.Indicator />
                    </RadioGroup.Item>
                    <Label htmlFor="on_change" flex={1}>
                      On Every Change
                      <Text
                        style={{
                          fontSize: 12,
                          color: (theme.gray9?.val as string) || "gray",
                          marginTop: 4,
                        }}
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
        <Card bordered style={{ padding: 16, marginTop: 16 }}>
          <H4 style={{ marginBottom: 12, fontSize: 16 }}>App Information</H4>

          <YStack gap="$3">
            {/* Current Version */}
            <XStack
              style={
                { alignItems: "center", justifyContent: "space-between" } as any
              }
            >
              <Text style={{ color: (theme.gray11?.val as string) || "gray" }}>
                Current Version
              </Text>
              <Text style={{ fontWeight: "bold" }}>v{APP_CONFIG.version}</Text>
            </XStack>

            {/* Update Info */}
            {updateInfo && !updateInfo.error && (
              <XStack
                style={
                  {
                    alignItems: "center",
                    justifyContent: "space-between",
                  } as any
                }
              >
                <Text
                  style={{ color: (theme.gray11?.val as string) || "gray" }}
                >
                  Latest Version
                </Text>
                <Text
                  style={{
                    fontWeight: "bold",
                    color: updateInfo.hasUpdate
                      ? (theme.green10?.val as string) || "green"
                      : (theme.gray11?.val as string) || "gray",
                  }}
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
          color="$red10"
          onPress={handleClearConfig}
          style={{ marginTop: 16 }}
        >
          Clear Configuration
        </Button>
      </YStack>
    </ScrollView>
  );
}
