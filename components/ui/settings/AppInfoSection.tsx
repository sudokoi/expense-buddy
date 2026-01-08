import { YStack, XStack, Text, Button } from "tamagui"
import { ViewStyle } from "react-native"
import { Download, ExternalLink } from "@tamagui/lucide-icons"
import { UpdateInfo } from "../../../services/update-checker"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"

/**
 * Props for the AppInfoSection component
 *
 * This component handles the app information UI including:
 * - Current version display
 * - Update checking functionality
 * - Links to GitHub and release downloads
 */
export interface AppInfoSectionProps {
  /** Current app version string */
  currentVersion: string
  /** Update information from GitHub releases check */
  updateInfo: UpdateInfo | null
  /** Whether an update check is in progress */
  isCheckingUpdate: boolean
  /** Callback to check for updates */
  onCheckForUpdates: () => Promise<void>
  /** Callback to open the release page */
  onOpenRelease: () => void
  /** Callback to open the GitHub repository */
  onOpenGitHub: () => void
}

// Layout styles for the component
const layoutStyles = {
  versionRow: {
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
}

// Memoized theme colors
const successColor = SEMANTIC_COLORS.success

/**
 * AppInfoSection - App information UI
 *
 * Provides:
 * - Current version display
 * - Latest version display (when available)
 * - Check for updates button
 * - Download update button (when update available)
 * - GitHub repository link
 */
export function AppInfoSection({
  currentVersion,
  updateInfo,
  isCheckingUpdate,
  onCheckForUpdates,
  onOpenRelease,
  onOpenGitHub,
}: AppInfoSectionProps) {
  return (
    <YStack gap="$3">
      {/* Current Version */}
      <XStack style={layoutStyles.versionRow}>
        <Text color="$color" opacity={0.8}>
          Current Version
        </Text>
        <Text fontWeight="bold">v{currentVersion}</Text>
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
        onPress={onCheckForUpdates}
        disabled={isCheckingUpdate}
        icon={Download}
      >
        {isCheckingUpdate ? "Checking..." : "Check for Updates"}
      </Button>

      {/* Update Available - Open Release */}
      {updateInfo?.hasUpdate && (
        <Button size="$4" themeInverse onPress={onOpenRelease} icon={ExternalLink}>
          Download v{updateInfo.latestVersion}
        </Button>
      )}

      {/* GitHub Link */}
      <Button size="$3" chromeless onPress={onOpenGitHub} icon={ExternalLink}>
        View on GitHub
      </Button>
    </YStack>
  )
}

export type { UpdateInfo }
