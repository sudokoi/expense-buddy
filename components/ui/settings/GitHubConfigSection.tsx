import { useState, useCallback, useEffect } from "react"
import { YStack, XStack, Text, Input, Button, Label, Accordion } from "tamagui"
import { Keyboard, ViewStyle, Platform, TextStyle, Linking } from "react-native"
import { Check, X, ChevronDown } from "@tamagui/lucide-icons"
import * as Clipboard from "expo-clipboard"
import { SyncConfig } from "../../../types/sync"
import { validateGitHubConfig } from "../../../utils/github-config-validation"
import { SEMANTIC_COLORS, ACCENT_COLORS } from "../../../constants/theme-colors"
import { getGitHubOAuthClientIdStatus } from "../../../constants/runtime-config"
import { useRouter, usePathname } from "expo-router"
import { secureStorage } from "../../../services/secure-storage"
import { useGitHubAuthMachine } from "../../../hooks/use-github-auth-machine"

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

// Layout styles for the component
const layoutStyles = {
  buttonRow: {
    flexWrap: "wrap",
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
    minWidth: 0,
  } as ViewStyle,
  connectedBadge: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  } as ViewStyle,
  accordionContent: {
    padding: 8,
    paddingTop: 12,
  } as ViewStyle,
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
    const validation = validateGitHubConfig(normalized)

    if (!validation.success) {
      setConfigErrors(validation.errors)
      onNotification("Please fix the validation errors", "error")
      return
    }

    // Clear errors on successful validation
    setConfigErrors({})

    const config: SyncConfig = normalized
    onSaveConfig(config)
  }, [token, repo, branch, onSaveConfig, onNotification])

  const handleStartGitHubLogin = useCallback(() => {
    const status = getGitHubOAuthClientIdStatus()
    if (!status.ok) {
      onNotification(status.error, "error")
      return
    }

    auth.signIn({
      onSignedIn: () => {
        onNotification("GitHub sign-in successful", "success")
        router.push("/github/repo-picker")
      },
      onError: (message) => {
        onNotification(message, "error")
      },
    })
  }, [auth, onNotification, router])

  const handleCopyDeviceCode = useCallback(async () => {
    const code = auth.deviceCode?.user_code
    if (!code) return

    try {
      await Clipboard.setStringAsync(code)
      onNotification("Code copied to clipboard", "success")
    } catch (error) {
      onNotification(String(error), "error")
    }
  }, [auth.deviceCode?.user_code, onNotification])

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
      onNotification("Signed out of GitHub", "success")
    } catch (error) {
      onNotification(String(error), "error")
    }
  }, [auth, handleClearConfig, onConnectionStatusChange, onNotification, syncConfig])

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
        <Accordion.Trigger bg="$backgroundHover" style={layoutStyles.accordionTrigger}>
          {({ open }: { open: boolean }) => (
            <>
              <XStack style={layoutStyles.accordionTriggerInner}>
                <Text fontWeight="500">GitHub Configuration</Text>
                {isConfigured && (
                  <YStack style={layoutStyles.connectedBadge}>
                    <XStack
                      style={{ minWidth: 0, alignItems: "center", gap: 4 } as ViewStyle}
                    >
                      <Check size={14} color={successColor} />
                      <Text fontSize="$2" color={successColor}>
                        Connected
                      </Text>
                    </XStack>
                    {repo ? (
                      <Text
                        fontSize="$2"
                        color="$color"
                        opacity={0.7}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                        style={{ flexShrink: 1, minWidth: 0 } as TextStyle}
                      >
                        {repo}
                      </Text>
                    ) : null}
                  </YStack>
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
            {/* Auth */}
            {isWeb ? (
              <YStack gap="$2">
                <Label>GitHub Personal Access Token</Label>
                <Input
                  secureTextEntry
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChangeText={handleTokenChange}
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
            ) : (
              <YStack gap="$2">
                <Label>GitHub Login</Label>
                <Button
                  size="$4"
                  onPress={isSignedIn ? handleSignOut : handleStartGitHubLogin}
                  disabled={auth.isSigningIn || (!isSignedIn && !githubOAuthStatus.ok)}
                  themeInverse
                  style={
                    isSignedIn
                      ? ({ backgroundColor: errorColor } as ViewStyle)
                      : undefined
                  }
                >
                  {auth.isSigningIn
                    ? "Signing in..."
                    : isSignedIn
                      ? "Sign out"
                      : "Sign in with GitHub"}
                </Button>
                {!githubOAuthStatus.ok && (
                  <Text fontSize="$2" color="$red10">
                    {githubOAuthStatus.error}
                  </Text>
                )}
                {auth.deviceCode && (
                  <YStack gap="$2" style={{ paddingTop: 4 } as ViewStyle}>
                    <Text fontSize="$2" color="$color" opacity={0.8}>
                      Enter this code on GitHub:
                    </Text>
                    <XStack
                      gap="$2"
                      style={{ alignItems: "center", flexWrap: "wrap" } as ViewStyle}
                    >
                      <Text fontSize="$6" fontWeight="700">
                        {auth.deviceCode.user_code}
                      </Text>
                      <Button size="$3" onPress={() => void handleCopyDeviceCode()}>
                        Copy code
                      </Button>
                    </XStack>
                    <Button
                      size="$3"
                      onPress={() => {
                        const url =
                          auth.deviceCode?.verification_uri_complete ||
                          auth.deviceCode?.verification_uri
                        if (url) {
                          void Linking.openURL(url)
                        }
                      }}
                    >
                      Open GitHub in browser
                    </Button>
                    <Text fontSize="$2" color="$color" opacity={0.8}>
                      If the browser didn’t open, visit {auth.deviceCode.verification_uri}
                    </Text>
                  </YStack>
                )}
                <Text fontSize="$2" color="$color" opacity={0.6}>
                  Personal accounts only. Organization repositories aren’t supported.
                </Text>
              </YStack>
            )}

            {/* Repository */}
            <YStack gap="$2">
              <Label>Repository</Label>
              {isWeb ? (
                <Input
                  placeholder="username/repo-name"
                  value={repo}
                  onChangeText={handleRepoChange}
                  size="$4"
                  borderWidth={2}
                  borderColor={configErrors.repo ? "$red10" : "$borderColor"}
                />
              ) : (
                <YStack gap="$2">
                  <Input
                    placeholder="Choose a repository"
                    value={repo}
                    editable={false}
                    size="$4"
                    borderWidth={2}
                    borderColor={configErrors.repo ? "$red10" : "$borderColor"}
                  />
                  <Button size="$3" onPress={handleChooseRepo} disabled={!token}>
                    {repo ? "Edit" : "Choose repository"}
                  </Button>
                </YStack>
              )}
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
                onChangeText={handleBranchChange}
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
  )
}

export type { SyncConfig }
