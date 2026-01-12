/**
 * React hook for managing app update checks and notifications
 *
 * Provides a clean API for React components to:
 * - Check for updates on app launch (once per session)
 * - Display update notification banner
 * - Handle update action (open Play Store or GitHub)
 * - Handle dismissal (persist dismissed version)
 * - Manually check for updates (bypasses dismissal)
 */
import { useState, useCallback, useEffect, useRef } from "react"
import { Linking } from "react-native"
import {
  checkForUpdatesOnLaunch,
  checkForUpdates,
  getDismissedVersion,
  setDismissedVersion,
  shouldShowUpdateNotification,
  isPlayStoreInstall,
  UpdateInfo,
} from "../services/update-checker"
import { APP_CONFIG } from "../constants/app-config"
import { notificationStore } from "../stores/notification-store"

export interface UseUpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean
  /** The latest version available (if any) */
  latestVersion: string | null
  /** Whether to show the update banner */
  showBanner: boolean
  /** Whether the automatic update check has completed at least once this session */
  updateCheckCompleted: boolean
  /** Handle user tapping the Update button */
  handleUpdate: () => Promise<void>
  /** Handle user dismissing the update notification */
  handleDismiss: () => Promise<void>
  /** Manually check for updates (bypasses dismissal) */
  checkForUpdates: () => Promise<void>
}

/**
 * Get the appropriate update URL based on install source
 * Returns Play Store URL for Play Store installs, GitHub releases URL otherwise
 */
export async function getUpdateUrl(releaseUrl?: string): Promise<string> {
  const fromPlayStore = await isPlayStoreInstall()

  if (fromPlayStore && APP_CONFIG.playStore?.url) {
    return APP_CONFIG.playStore.url
  }

  // Fall back to GitHub releases URL or default GitHub URL
  return releaseUrl || `${APP_CONFIG.github.url}/releases`
}

/**
 * Hook for managing app update checks and notifications
 */
export function useUpdateCheck(): UseUpdateCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [releaseUrl, setReleaseUrl] = useState<string | undefined>(undefined)
  const [updateCheckCompleted, setUpdateCheckCompleted] = useState(false)

  // Track if initial check has been performed
  const hasPerformedInitialCheck = useRef(false)

  /**
   * Process update info and determine if banner should be shown
   */
  const processUpdateInfo = useCallback(
    async (updateInfo: UpdateInfo, bypassDismissal: boolean = false) => {
      if (updateInfo.hasUpdate && updateInfo.latestVersion) {
        setUpdateAvailable(true)
        setLatestVersion(updateInfo.latestVersion)
        setReleaseUrl(updateInfo.releaseUrl)

        if (bypassDismissal) {
          // Manual check - always show banner
          setShowBanner(true)
        } else {
          // Auto check - respect dismissal
          const dismissedVersion = await getDismissedVersion()
          const shouldShow = shouldShowUpdateNotification(updateInfo, dismissedVersion)
          setShowBanner(shouldShow)
        }
      } else {
        setUpdateAvailable(false)
        setLatestVersion(null)
        setShowBanner(false)
      }
    },
    []
  )

  /**
   * Check for updates on mount (once per session)
   */
  useEffect(() => {
    if (hasPerformedInitialCheck.current) {
      return
    }
    hasPerformedInitialCheck.current = true

    const performCheck = async () => {
      try {
        const updateInfo = await checkForUpdatesOnLaunch()
        if (updateInfo) {
          await processUpdateInfo(updateInfo, false)
        }
      } finally {
        setUpdateCheckCompleted(true)
      }
    }

    performCheck()
  }, [processUpdateInfo])

  /**
   * Handle user tapping the Update button
   * Opens Play Store for Play Store installs, GitHub releases otherwise
   */
  const handleUpdate = useCallback(async () => {
    try {
      const url = await getUpdateUrl(releaseUrl)
      const canOpen = await Linking.canOpenURL(url)

      if (canOpen) {
        await Linking.openURL(url)
      } else {
        // Show error notification with URL for manual copying
        notificationStore.trigger.addNotification({
          message: `Could not open URL. Please visit: ${url}`,
          notificationType: "error",
          duration: 8000,
        })
      }
    } catch (error) {
      console.error("Failed to open update URL:", error)
      notificationStore.trigger.addNotification({
        message: "Failed to open update page. Please try again.",
        notificationType: "error",
      })
    }
  }, [releaseUrl])

  /**
   * Handle user dismissing the update notification
   * Stores the dismissed version and hides the banner
   */
  const handleDismiss = useCallback(async () => {
    if (latestVersion) {
      await setDismissedVersion(latestVersion)
    }
    setShowBanner(false)
  }, [latestVersion])

  /**
   * Manually check for updates (bypasses dismissal)
   * Used from settings screen
   */
  const manualCheckForUpdates = useCallback(async () => {
    const updateInfo = await checkForUpdates()

    if (updateInfo.error && !updateInfo.hasUpdate) {
      // Show error notification for manual checks
      notificationStore.trigger.addNotification({
        message: updateInfo.error,
        notificationType: "error",
      })
      return
    }

    if (updateInfo.hasUpdate) {
      // Bypass dismissal for manual checks
      await processUpdateInfo(updateInfo, true)
    } else {
      // No update available
      notificationStore.trigger.addNotification({
        message: "You have the latest version!",
        notificationType: "success",
      })
    }
  }, [processUpdateInfo])

  return {
    updateAvailable,
    latestVersion,
    showBanner,
    updateCheckCompleted,
    handleUpdate,
    handleDismiss,
    checkForUpdates: manualCheckForUpdates,
  }
}
