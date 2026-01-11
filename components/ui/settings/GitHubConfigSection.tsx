import { useState, useCallback } from "react"
import { YStack, XStack, Text, Input, Button, Label, Accordion } from "tamagui"
import { Keyboard, ViewStyle } from "react-native"
import { Check, X, ChevronDown } from "@tamagui/lucide-icons"
import { SyncConfig } from "../../../types/sync"
import { validateGitHubConfig } from "../../../utils/github-config-validation"
import { SEMANTIC_COLORS, ACCENT_COLORS } from "../../../constants/theme-colors"

/**
 * Props for the GitHubConfigSection component
 *
 * This component handles the GitHub configuration form including:
 * - Personal Access Token input
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
}

// Memoized theme colors
const successColor = SEMANTIC_COLORS.success
const errorColor = SEMANTIC_COLORS.error
const primaryColor = ACCENT_COLORS.primary

/**
 * GitHubConfigSection - Collapsible GitHub configuration form
 *
 * Provides a form for configuring GitHub sync with:
 * - Personal Access Token (secure input)
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
  // Form state initialized from syncConfig
  const [token, setToken] = useState(syncConfig?.token ?? "")
  const [repo, setRepo] = useState(syncConfig?.repo ?? "")
  const [branch, setBranch] = useState(syncConfig?.branch ?? "main")

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

  const handleTestConnection = useCallback(async () => {
    Keyboard.dismiss()
    onConnectionStatusChange("idle")
    await onTestConnection()
  }, [onTestConnection, onConnectionStatusChange])

  const handleClearConfig = useCallback(() => {
    onClearConfig()
    setToken("")
    setRepo("")
    setBranch("main")
    onConnectionStatusChange("idle")
  }, [onClearConfig, onConnectionStatusChange])

  const handleTokenChange = useCallback((text: string) => {
    setToken(text)
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

            {/* Repository */}
            <YStack gap="$2">
              <Label>Repository</Label>
              <Input
                placeholder="username/repo-name"
                value={repo}
                onChangeText={handleRepoChange}
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
