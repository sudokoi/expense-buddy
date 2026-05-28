import { useState, useCallback, useEffect } from "react"
import { YStack, XStack, Text, Input, Button, Label, Accordion } from "tamagui"
import { Keyboard, Platform, Linking } from "react-native"
import { Check, X, ChevronDown, ChevronUp } from "@tamagui/lucide-icons-2"
import * as Clipboard from "expo-clipboard"
import { SyncConfig } from "../../../types/sync"
import { validateGitHubConfig } from "../../../utils/github-config-validation"
import { SEMANTIC_COLORS, ACCENT_COLORS } from "../../../constants/theme-colors"
import { getGitHubOAuthClientIdStatus } from "../../../constants/runtime-config"
import { useRouter, usePathname } from "expo-router"
import { secureStorage } from "../../../services/secure-storage"
import { useGitHubAuthMachine } from "../../../hooks/use-github-auth-machine"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../../constants/ui-tokens"

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

// Memoized theme colors
const successColor = SEMANTIC_COLORS.success
const errorColor = SEMANTIC_COLORS.error
const primaryColor = ACCENT_COLORS.primary

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
  const pathname = usePathname()

  const auth = useGitHubAuthMachine()
  const { token: nativeToken } = auth

  // Form state initialized from syncConfig
  // Web keeps manual token entry; native token comes from the auth machine.
  const [webToken, setWebToken] = useState(syncConfig?.token ?? "")
  const [repo, setRepo] = useState(syncConfig?.repo ?? "")
  const [branch, setBranch] = useState(syncConfig?.branch ?? "main")

  const isWeb = Platform.OS === "web"
  const githubOAuthStatus = getGitHubOAuthClientIdStatus()

  const token = isWeb ? webToken : nativeToken
  const isSignedIn = !isWeb && token.trim().length > 0

  useEffect(() => {
    if (Platform.OS === "web") return

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
  }, [pathname])

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
    onClearConfig()
    setWebToken("")
    setRepo("")
    setBranch("main")
    onConnectionStatusChange("idle")

    if (!isWeb) {
      auth.signOut()
    }
  }, [auth, isWeb, onClearConfig, onConnectionStatusChange])

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

  const handleTokenChange = useCallback((text: string) => {
    setWebToken(text)
    // Clear error when user starts typing
    setConfigErrors((prev) => {
      if (prev.token) {
        const { token: _, ...rest } = prev
        return rest
      }
      return prev
    })
  }, [])

  const handleRepoChange = useCallback((text: string) => {
    setRepo(text)
    // Clear error when user starts typing
    setConfigErrors((prev) => {
      if (prev.repo) {
        const { repo: _, ...rest } = prev
        return rest
      }
      return prev
    })
  }, [])

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
    <Accordion type="single" collapsible defaultValue={undefined}>
      <Accordion.Item value="github-config">
        <Accordion.Trigger
          bg="$backgroundHover"
          flexDirection="row"
          justify="space-between"
          p={UI_SPACE.section}
          rounded={UI_RADIUS.control}
        >
          {({ open }: { open: boolean }) => (
            <>
              <XStack
                flexDirection="row"
                items="center"
                flex={1}
                gap={UI_SPACE.control}
                minW={0}
                maxW="85%"
              >
                <Text fontWeight={UI_FONT_WEIGHT.medium}>
                  {t("settings.github.configTitle")}
                </Text>
                {isConfigured && (
                  <YStack
                    flexDirection="column"
                    items="flex-start"
                    gap={UI_SPACE.micro / 2}
                    shrink={1}
                    minW={0}
                  >
                    <XStack
                      style={{
                        minWidth: 0,
                        alignItems: "center",
                        gap: UI_SPACE.micro,
                      }}
                    >
                      <Check size={14} color={successColor} />
                      <Text fontSize="$caption" color={successColor}>
                        {t("settings.github.connected")}
                      </Text>
                    </XStack>
                    {repo ? (
                      <Text
                        fontSize="$caption"
                        color="$color"
                        opacity={UI_OPACITY.medium}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                        style={{ flexShrink: 1, minWidth: 0 }}
                      >
                        {repo}
                      </Text>
                    ) : null}
                  </YStack>
                )}
              </XStack>
              {open ? (
                <ChevronUp
                  size={UI_ICON_SIZE.medium}
                  color="$color"
                  opacity={UI_OPACITY.subtle}
                />
              ) : (
                <ChevronDown
                  size={UI_ICON_SIZE.medium}
                  color="$color"
                  opacity={UI_OPACITY.subtle}
                />
              )}
            </>
          )}
        </Accordion.Trigger>
        <Accordion.Content p={UI_SPACE.control} pt={UI_SPACE.section}>
          <YStack gap="$section">
            {/* Auth */}
            {isWeb ? (
              <YStack gap="$control">
                <Label>{t("settings.github.tokenLabel")}</Label>
                <Input
                  secureTextEntry
                  bg="$background"
                  placeholder={t("settings.github.tokenPlaceholder")}
                  value={token}
                  onChangeText={handleTokenChange}
                  size="$control"
                  borderWidth={UI_BORDER_WIDTH.normal}
                  borderColor={configErrors.token ? "$red10" : "$borderColor"}
                  focusStyle={{
                    borderColor: configErrors.token ? "$red10" : ACCENT_COLORS.primary,
                  }}
                />
                {configErrors.token ? (
                  <Text fontSize="$caption" color="$red10">
                    {configErrors.token}
                  </Text>
                ) : (
                  <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
                    {t("settings.github.tokenHelp")}
                  </Text>
                )}
              </YStack>
            ) : (
              <YStack gap="$control">
                <Label>{t("settings.github.loginLabel")}</Label>
                <Button
                  size="$control"
                  onPress={isSignedIn ? handleSignOut : handleStartGitHubLogin}
                  disabled={auth.isSigningIn || (!isSignedIn && !githubOAuthStatus.ok)}
                  theme="accent"
                  style={isSignedIn ? { backgroundColor: errorColor } : undefined}
                >
                  {auth.isSigningIn
                    ? t("settings.github.signingIn")
                    : isSignedIn
                      ? t("settings.github.signOut")
                      : t("settings.github.signIn")}
                </Button>
                {!githubOAuthStatus.ok && (
                  <Text fontSize="$caption" color="$red10">
                    {githubOAuthStatus.error}
                  </Text>
                )}
                {auth.deviceCode && (
                  <YStack gap="$control" style={{ paddingTop: UI_SPACE.micro }}>
                    <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.strong}>
                      {t("settings.github.deviceCode")}
                    </Text>
                    <XStack
                      gap="$control"
                      style={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Text fontSize="$sectionTitle" fontWeight={UI_FONT_WEIGHT.bold}>
                        {auth.deviceCode.user_code}
                      </Text>
                      <Button size="$compact" onPress={() => void handleCopyDeviceCode()}>
                        {t("settings.github.copyCode")}
                      </Button>
                    </XStack>
                    <Button
                      size="$compact"
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
                    <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.strong}>
                      {t("settings.github.browserHelp", {
                        url: auth.deviceCode.verification_uri,
                      })}
                    </Text>
                  </YStack>
                )}
                <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
                  {t("settings.github.loginHelp")}
                </Text>
              </YStack>
            )}

            {/* Repository */}
            <YStack gap="$control">
              <Label>{t("settings.github.repoLabel")}</Label>
              {isWeb ? (
                <Input
                  bg="$background"
                  placeholder={t("settings.github.repoPlaceholderWeb")}
                  value={repo}
                  onChangeText={handleRepoChange}
                  size="$control"
                  borderWidth={UI_BORDER_WIDTH.normal}
                  borderColor={configErrors.repo ? "$red10" : "$borderColor"}
                  focusStyle={{
                    borderColor: configErrors.repo ? "$red10" : ACCENT_COLORS.primary,
                  }}
                />
              ) : (
                <YStack gap="$control">
                  <Input
                    bg="$background"
                    placeholder={t("settings.github.repoPlaceholderNative")}
                    value={repo}
                    readOnly
                    size="$control"
                    borderWidth={UI_BORDER_WIDTH.normal}
                    borderColor={configErrors.repo ? "$red10" : "$borderColor"}
                    focusStyle={{
                      borderColor: configErrors.repo ? "$red10" : ACCENT_COLORS.primary,
                    }}
                  />
                  <Button size="$compact" onPress={handleChooseRepo} disabled={!token}>
                    {repo
                      ? t("settings.github.editRepo")
                      : t("settings.github.chooseRepo")}
                  </Button>
                </YStack>
              )}
              {configErrors.repo && (
                <Text fontSize="$caption" color="$red10">
                  {configErrors.repo}
                </Text>
              )}
            </YStack>

            {/* Branch */}
            <YStack gap="$control">
              <Label>{t("settings.github.branchLabel")}</Label>
              <Input
                bg="$background"
                placeholder="main"
                value={branch}
                onChangeText={handleBranchChange}
                size="$control"
                borderWidth={UI_BORDER_WIDTH.normal}
                borderColor={configErrors.branch ? "$red10" : "$borderColor"}
                focusStyle={{
                  borderColor: configErrors.branch ? "$red10" : ACCENT_COLORS.primary,
                }}
              />
              {configErrors.branch && (
                <Text fontSize="$caption" color="$red10">
                  {configErrors.branch}
                </Text>
              )}
            </YStack>

            {/* Action Buttons */}
            <XStack gap="$section" flexWrap="wrap">
              <Button flex={1} size="$control" onPress={handleSaveConfig} theme="accent">
                {t("settings.github.saveConfig")}
              </Button>
              <Button
                flex={1}
                size="$control"
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
                color="white"
              >
                {isTesting ? t("settings.github.testing") : t("settings.github.test")}
              </Button>
            </XStack>

            {/* Clear Configuration Button */}
            {isConfigured && (
              <Button
                size="$compact"
                color="white"
                onPress={handleClearConfig}
                icon={X}
                style={{ marginTop: UI_SPACE.section, backgroundColor: errorColor }}
              >
                {t("settings.github.clearConfig")}
              </Button>
            )}
          </YStack>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  )
}

export type { SyncConfig }
