import { Text, View } from "react-native"

import { Download, ExternalLink, Bug } from "lucide-react-native"
import { UpdateInfo } from "../../../services/update-checker"
import { useTranslation } from "react-i18next"
import { Button } from "../Button"

/**
 * Props for the AppInfoSection component
 *
 * This component handles the app information UI including:
 * - Current version display
 * - Update checking functionality
 * - Links to GitHub and release downloads
 * - Issue reporting
 */
export interface AppInfoSectionProps {
  /** Current app version string */
  currentVersion: string
  /** Update information from GitHub releases check */
  updateInfo: UpdateInfo | null
  /** Whether the update payload has already downloaded */
  isUpdateReadyToInstall: boolean
  /** Whether an update check is in progress */
  isCheckingUpdate: boolean
  /** Callback to check for updates */
  onCheckForUpdates: () => Promise<void>
  /** Callback to start or complete the update */
  onStartUpdate: () => void
  /** Callback to open the GitHub repository */
  onOpenGitHub: () => void
  /** Callback to open the issue reporting page */
  onReportIssue: () => void
}

/**
 * AppInfoSection - App information UI
 *
 * Provides:
 * - Current version display
 * - Latest version display (when available)
 * - Check for updates button
 * - Download update button (when update available)
 * - Issue reporting link
 * - GitHub repository link
 */
export function AppInfoSection({
  currentVersion,
  updateInfo,
  isUpdateReadyToInstall,
  isCheckingUpdate,
  onCheckForUpdates,
  onStartUpdate,
  onOpenGitHub,
  onReportIssue,
}: AppInfoSectionProps) {
  const { t } = useTranslation()

  return (
    <View className="gap-3">
      {/* Current Version */}
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground opacity-80">
          {t("settings.about.currentVersion")}
        </Text>
        <Text className="font-bold text-foreground">v{currentVersion}</Text>
      </View>

      {/* Update Info */}
      {updateInfo?.latestVersion && !updateInfo.error && (
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground opacity-80">
            {t("settings.about.latestVersion")}
          </Text>
          <Text
            className={`font-bold ${
              updateInfo.hasUpdate ? "text-success" : "text-foreground opacity-80"
            }`}
          >
            v{updateInfo.latestVersion}
          </Text>
        </View>
      )}

      {/* Check for Updates Button */}
      <Button
        size="control"
        className="gap-2"
        onPress={onCheckForUpdates}
        disabled={isCheckingUpdate}
      >
        <Download size={16} />
        {isCheckingUpdate
          ? t("settings.about.checking")
          : t("settings.about.checkForUpdates")}
      </Button>

      {/* Update Available - Open Release */}
      {updateInfo?.hasUpdate && (
        <Button size="control" variant="accent" className="gap-2" onPress={onStartUpdate}>
          <ExternalLink size={16} />
          {isUpdateReadyToInstall
            ? t("settings.about.installUpdate")
            : updateInfo.latestVersion
              ? t("settings.about.download", { version: updateInfo.latestVersion })
              : t("settings.about.updateNow")}
        </Button>
      )}

      {/* Report an Issue */}
      <Button size="compact" variant="ghost" className="gap-2" onPress={onReportIssue}>
        <Bug size={16} />
        {t("settings.about.reportIssue")}
      </Button>

      {/* GitHub Link */}
      <Button size="compact" variant="ghost" className="gap-2" onPress={onOpenGitHub}>
        <ExternalLink size={16} />
        {t("settings.about.viewGitHub")}
      </Button>
    </View>
  )
}

export type { UpdateInfo }
