import { Text, View } from "react-native"

import { Download, ExternalLink, Bug } from "lucide-react-native"
import { UpdateInfo } from "../../../services/update-checker"
import { useTranslation } from "react-i18next"
import { Button } from "../Button"
import { Spinner } from "../Spinner"

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
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {/* Current Version */}
        <View className="min-w-[120px] flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">
            {t("settings.about.currentVersion")}
          </Text>
          <Text className="text-base font-semibold text-foreground">
            v{currentVersion}
          </Text>

          {/* Update Info */}
          {updateInfo?.latestVersion && !updateInfo.error && (
            <Text className="text-xs text-muted-foreground">
              {t("settings.about.latestVersion")}: v{updateInfo.latestVersion}
            </Text>
          )}
        </View>

        {/* Check for Updates Button */}
        <Button
          size="control"
          className="max-w-full"
          icon={isCheckingUpdate ? <Spinner size="small" /> : <Download size={16} />}
          onPress={onCheckForUpdates}
          disabled={isCheckingUpdate}
        >
          {isCheckingUpdate
            ? t("settings.about.checking")
            : t("settings.about.checkForUpdates")}
        </Button>
      </View>

      {/* Update Available - Open Release */}
      {updateInfo?.hasUpdate && (
        <Button
          size="control"
          variant="accent"
          icon={<ExternalLink size={16} />}
          onPress={onStartUpdate}
        >
          {isUpdateReadyToInstall
            ? t("settings.about.installUpdate")
            : updateInfo.latestVersion
              ? t("settings.about.download", { version: updateInfo.latestVersion })
              : t("settings.about.updateNow")}
        </Button>
      )}

      {/* Report an Issue */}
      <View className="flex-row flex-wrap gap-2 border-t border-border pt-1">
        <Button
          size="compact"
          className="min-w-[140px] flex-1"
          variant="ghost"
          icon={<Bug size={16} />}
          onPress={onReportIssue}
        >
          {t("settings.about.reportIssue")}
        </Button>

        {/* GitHub Link */}
        <Button
          size="compact"
          className="min-w-[140px] flex-1"
          variant="ghost"
          icon={<ExternalLink size={16} />}
          onPress={onOpenGitHub}
        >
          {t("settings.about.viewGitHub")}
        </Button>
      </View>
    </View>
  )
}

export type { UpdateInfo }
