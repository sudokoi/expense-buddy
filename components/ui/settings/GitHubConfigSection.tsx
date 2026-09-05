import { useState, useCallback } from "react"
import { Alert, Keyboard, Linking, Pressable, Text, View } from "react-native"
import { Check, X, ChevronDown, ChevronUp } from "lucide-react-native"
import * as Clipboard from "expo-clipboard"
import { SyncConfig } from "../../../types/sync"
import { validateGitHubConfig } from "../../../utils/github-config-validation"
import {
  SEMANTIC_COLORS,
  SEMANTIC_FOREGROUND_COLORS,
  getReadableTextColor,
} from "../../../constants/palette"
import { getGitHubOAuthClientIdStatus } from "../../../constants/runtime-config"
import { useRouter, useFocusEffect } from "expo-router"
import { secureStorage } from "../../../services/secure-storage"
import { useGitHubAuthMachine } from "../../../hooks/use-github-auth-machine"
import { useTranslation } from "react-i18next"
import { Button } from "../Button"
import { Input } from "../Input"
import { Label } from "../Label"
import { Spinner } from "../Spinner"
import { useThemeColors, useThemeScheme } from "../../../hooks/use-theme-colors"
import { UI_SPACE, UI_OPACITY, UI_ICON_SIZE } from "../../../constants/ui-tokens"

const REPO_KEY = "github_repo"
const BRANCH_KEY = "github_branch"

/**
 * Props for the GitHubConfigSection component
 *
 * This component handles the GitHub configuration form including:
 * - GitHub login (native) or Personal Access Token input (web)
 * - Repository input
 * - Branch input
 * - Save and Test connection buttons
 * - Clear configuration button
 */
export interface GitHubConfigSectionProps {
  /** Current sync configuration, null if not configured */
  syncConfig: SyncConfig | null
  /** Callback when configuration is saved */
  onSaveConfig: (config: SyncConfig) => void
  /** Callback to test the connection */
  onTestConnection: () => Promise<void>
  /** Callback to clear the configuration */
  onClearConfig: () => void
  /** Whether a connection test is in progress */
  isTesting: boolean
  /** Current connection test status */
  connectionStatus: "idle" | "success" | "error"
  /** Callback when connection status changes */
  onConnectionStatusChange: (status: "idle" | "success" | "error") => void
  /** Callback to show notification */
  onNotification: (message: string, type: "success" | "error" | "info") => void
}

// Memoized theme colors — success/error use pastel fills with readable dark text (WCAG AA)
const successColor = SEMANTIC_COLORS.success
const errorColor = SEMANTIC_COLORS.error
const successTextColor = getReadableTextColor(successColor)
const errorTextColor = getReadableTextColor(errorColor)

/**
 * GitHubConfigSection - Collapsible GitHub configuration form
 *
 * Provides a form for configuring GitHub sync with:
 * - GitHub login (native) or Personal Access Token (web)
 * - Repository name (owner/repo format)
 * - Branch name
 * - Save and Test buttons
 * - Clear configuration option when configured
 */
export function GitHubConfigSection({
  syncConfig,
  onSaveConfig,
  onTestConnection,
  onClearConfig,
  isTesting,
  connectionStatus,
  onConnectionStatusChange,
  onNotification,
}: GitHubConfigSectionProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useThemeColors()
  const themeScheme = useThemeScheme()

  const auth = useGitHubAuthMachine()
  const { token } = auth

  // Form state initialized from syncConfig
  const [repo, setRepo] = useState(syncConfig?.repo ?? "")
  const [branch, setBranch] = useState(syncConfig?.branch ?? "main")
  const [expanded, setExpanded] = useState(false)

  const githubOAuthStatus = getGitHubOAuthClientIdStatus()

  const isSignedIn = token.trim().length > 0

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      const refreshDraftFromStorage = async () => {
        try {
          const [storedRepo, storedBranch] = await Promise.all([
            secureStorage.getItem(REPO_KEY),
            secureStorage.getItem(BRANCH_KEY),
          ])

          if (cancelled) return

          if (storedRepo) {
            setRepo((current) => (current === storedRepo ? current : storedRepo))
          }
          if (storedBranch) {
            setBranch((current) => (current === storedBranch ? current : storedBranch))
          }
        } catch {
          // Non-fatal: repo picker might not have written anything.
        }
      }

      void refreshDraftFromStorage()

      return () => {
        cancelled = true
      }
    }, [])
  )

  // Validation errors
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})

  // Derive isConfigured from syncConfig
  const isConfigured = syncConfig !== null

  const handleSaveConfig = useCallback(() => {
    // Dismiss keyboard to ensure button press is captured
    Keyboard.dismiss()

    const normalized = {
      token: token.trim(),
      repo: repo.trim(),
      branch: branch.trim(),
    }

    // Validate GitHub configuration with Zod
    const validation = validateGitHubConfig(normalized, t)

    if (!validation.success) {
      setConfigErrors(validation.errors)
      onNotification(t("settings.github.validationError"), "error")
      return
    }

    // Clear errors on successful validation
    setConfigErrors({})

    const config: SyncConfig = normalized
    onSaveConfig(config)
  }, [token, repo, branch, onSaveConfig, onNotification, t])

  const handleStartGitHubLogin = useCallback(() => {
    const status = getGitHubOAuthClientIdStatus()
    if (!status.ok) {
      onNotification(status.error, "error")
      return
    }

    auth.signIn({
      onSignedIn: () => {
        onNotification(t("settings.github.successSignIn"), "success")
        router.push("/github/repo-picker")
      },
      onError: (message) => {
        onNotification(message, "error")
      },
    })
  }, [auth, onNotification, router, t])

  const handleCopyDeviceCode = useCallback(async () => {
    const code = auth.deviceCode?.user_code
    if (!code) return

    try {
      await Clipboard.setStringAsync(code)
      onNotification(t("settings.github.copyCode"), "success")
    } catch (error) {
      onNotification(String(error), "error")
    }
  }, [auth.deviceCode?.user_code, onNotification, t])

  const handleChooseRepo = useCallback(() => {
    router.push("/github/repo-picker")
  }, [router])

  const handleTestConnection = useCallback(async () => {
    Keyboard.dismiss()
    onConnectionStatusChange("idle")
    await onTestConnection()
  }, [onTestConnection, onConnectionStatusChange])

  const handleClearConfig = useCallback(() => {
    Alert.alert(
      t("settings.github.clearConfigDialogTitle"),
      t("settings.github.clearConfigDialogMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.github.clearConfig"),
          style: "destructive",
          onPress: () => {
            onClearConfig()
            setRepo("")
            setBranch("main")
            onConnectionStatusChange("idle")

            auth.signOut()
          },
        },
      ]
    )
  }, [auth, onClearConfig, onConnectionStatusChange, t])

  const handleSignOut = useCallback(async () => {
    // If a full sync config is saved, signing out should fully disconnect.
    if (syncConfig) {
      handleClearConfig()
      return
    }

    try {
      auth.signOut()
      onConnectionStatusChange("idle")
      onNotification(t("settings.github.signOut"), "success")
    } catch (error) {
      onNotification(String(error), "error")
    }
  }, [auth, handleClearConfig, onConnectionStatusChange, onNotification, syncConfig, t])

  const handleBranchChange = useCallback((text: string) => {
    setBranch(text)
    // Clear error when user starts typing
    setConfigErrors((prev) => {
      if (prev.branch) {
        const { branch: _, ...rest } = prev
        return rest
      }
      return prev
    })
  }, [])

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t("settings.github.configTitle")}
        className="min-h-12 bg-surface flex-row items-center justify-between py-2 rounded-control"
      >
        <View className="flex-1 gap-1 pr-3">
          <Text className="font-medium text-foreground">
            {t("settings.github.configTitle")}
          </Text>
          {isConfigured && (
            <View className="flex-col items-start gap-0.5 shrink min-w-0">
              <View className="flex-row items-center gap-1">
                <Check
                  size={14}
                  color={SEMANTIC_FOREGROUND_COLORS[themeScheme].success}
                />
                <Text className="text-xs text-success">
                  {t("settings.github.connected")}
                </Text>
              </View>
              {repo ? (
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={2}
                  ellipsizeMode="middle"
                  style={{ flexShrink: 1, minWidth: 0 }}
                >
                  {repo}
                </Text>
              ) : null}
            </View>
          )}
        </View>
        {expanded ? (
          <ChevronUp
            size={UI_ICON_SIZE.medium}
            color={theme.foreground}
            style={{ opacity: UI_OPACITY.subtle }}
          />
        ) : (
          <ChevronDown
            size={UI_ICON_SIZE.medium}
            color={theme.foreground}
            style={{ opacity: UI_OPACITY.subtle }}
          />
        )}
      </Pressable>

      {expanded && (
        <View className="gap-3 p-2 pt-3">
          {/* Auth — Android only (device-flow) */}
          <View className="gap-2">
            <Label>{t("settings.github.loginLabel")}</Label>
            <Button
              size="control"
              onPress={isSignedIn ? handleSignOut : handleStartGitHubLogin}
              disabled={auth.isSigningIn || (!isSignedIn && !githubOAuthStatus.ok)}
              variant={isSignedIn ? "destructive" : "accent"}
            >
              {auth.isSigningIn
                ? t("settings.github.signingIn")
                : isSignedIn
                  ? t("settings.github.signOut")
                  : t("settings.github.signIn")}
            </Button>
            {!githubOAuthStatus.ok && (
              <Text className="text-xs text-error">{githubOAuthStatus.error}</Text>
            )}
            {auth.deviceCode && (
              <View className="gap-2" style={{ paddingTop: UI_SPACE.micro }}>
                <Text className="text-xs text-foreground opacity-80">
                  {t("settings.github.deviceCode")}
                </Text>
                <View
                  className="flex-row gap-2"
                  style={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <Text className="text-lg font-bold text-foreground">
                    {auth.deviceCode.user_code}
                  </Text>
                  <Button size="compact" onPress={() => void handleCopyDeviceCode()}>
                    {t("settings.github.copyCode")}
                  </Button>
                </View>
                <Button
                  size="compact"
                  onPress={() => {
                    const url =
                      auth.deviceCode?.verification_uri_complete ||
                      auth.deviceCode?.verification_uri
                    if (url) {
                      void Linking.openURL(url)
                    }
                  }}
                >
                  {t("settings.github.openBrowser")}
                </Button>
                <Text className="text-xs text-foreground opacity-80">
                  {t("settings.github.browserHelp", {
                    url: auth.deviceCode.verification_uri,
                  })}
                </Text>
              </View>
            )}
            <Text className="text-xs text-foreground opacity-60">
              {t("settings.github.loginHelp")}
            </Text>
          </View>

          {/* Repository */}
          <View className="gap-2">
            <Label>{t("settings.github.repoLabel")}</Label>
            <View className="gap-2">
              <Input
                className={configErrors.repo ? "border-error" : undefined}
                placeholder={t("settings.github.repoPlaceholderNative")}
                value={repo}
                accessibilityLabel={t("settings.github.repoLabel")}
                readOnly
              />
              <Button size="compact" onPress={handleChooseRepo} disabled={!token}>
                {repo ? t("settings.github.editRepo") : t("settings.github.chooseRepo")}
              </Button>
            </View>
            {configErrors.repo && (
              <Text className="text-xs text-error">{configErrors.repo}</Text>
            )}
          </View>

          {/* Branch */}
          <View className="gap-2">
            <Label>{t("settings.github.branchLabel")}</Label>
            <Input
              className={configErrors.branch ? "border-error" : undefined}
              placeholder="main"
              value={branch}
              accessibilityLabel={t("settings.github.branchLabel")}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={handleBranchChange}
            />
            {configErrors.branch && (
              <Text className="text-xs text-error">{configErrors.branch}</Text>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row flex-wrap gap-3">
            <Button
              className="flex-1"
              size="control"
              onPress={handleSaveConfig}
              variant="accent"
            >
              {t("settings.github.saveConfig")}
            </Button>
            <Button
              className="flex-1"
              style={
                connectionStatus === "success"
                  ? { backgroundColor: successColor }
                  : connectionStatus === "error"
                    ? { backgroundColor: errorColor }
                    : undefined
              }
              size="control"
              onPress={handleTestConnection}
              disabled={isTesting || !token || !repo}
              variant={
                connectionStatus === "success" || connectionStatus === "error"
                  ? "default"
                  : "outline"
              }
              icon={
                connectionStatus === "success" ? (
                  <Check size={16} color={successTextColor} />
                ) : connectionStatus === "error" ? (
                  <X size={16} color={errorTextColor} />
                ) : isTesting ? (
                  <Spinner size="small" color={theme.foreground} />
                ) : null
              }
            >
              <Text
                style={{
                  color:
                    connectionStatus === "success"
                      ? successTextColor
                      : connectionStatus === "error"
                        ? errorTextColor
                        : theme.foreground,
                }}
              >
                {isTesting ? t("settings.github.testing") : t("settings.github.test")}
              </Text>
            </Button>
          </View>

          {/* Clear Configuration Button */}
          {isConfigured && (
            <Button
              size="compact"
              variant="destructive"
              className="mt-3"
              icon={<X size={16} />}
              onPress={handleClearConfig}
            >
              {t("settings.github.clearConfig")}
            </Button>
          )}
        </View>
      )}
    </View>
  )
}

export type { SyncConfig }
