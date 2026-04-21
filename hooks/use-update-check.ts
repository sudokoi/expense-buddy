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
import { APP_CONFIG } from "../constants/app-config"
import {
  checkForUpdatesOnLaunch,
  checkForUpdates,
  getDismissedVersion,
  setDismissedVersion,
  shouldShowUpdateNotification,
  UpdateInfo,
} from "../services/update-checker"
import {
  completePlayStoreUpdate,
  PlayStoreInstallStatus,
  startPlayStoreFlexibleUpdate,
  subscribeToPlayStoreUpdateStatus,
} from "../services/play-store-update"
import { notificationStore } from "../stores/notification-store"

export type UpdateSource = "github" | "play-store"

export interface PerformUpdateActionOptions {
  installStatus: PlayStoreInstallStatus
  releaseUrl?: string
  updateSource: UpdateSource | null
}

export interface UseUpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean
  /** The latest version available (if any) */
  latestVersion: string | null
  /** Whether to show the update banner */
  showBanner: boolean
  /** Whether the automatic update check has completed at least once this session */
  updateCheckCompleted: boolean
  /** Whether the downloaded update is ready to install */
  isUpdateReadyToInstall: boolean
  /** Handle user tapping the Update button */
  handleUpdate: () => Promise<void>
  /** Handle user dismissing the update notification */
  handleDismiss: () => Promise<void>
  /** Manually check for updates (bypasses dismissal) */
  checkForUpdates: () => Promise<void>
}

export async function performUpdateAction({
  installStatus,
  releaseUrl,
  updateSource,
}: PerformUpdateActionOptions): Promise<void> {
  if (updateSource === "github") {
    const targetUrl = releaseUrl || `${APP_CONFIG.github.url}/releases`
    const canOpen = await Linking.canOpenURL(targetUrl)

    if (!canOpen) {
      notificationStore.trigger.addNotification({
        message: `Could not open release page. Please visit: ${targetUrl}`,
        notificationType: "error",
        duration: 8000,
      })
      return
    }

    await Linking.openURL(targetUrl)
    return
  }

  if (installStatus === "downloaded") {
    await completePlayStoreUpdate()
    return
  }

  if (
    installStatus === "downloading" ||
    installStatus === "installing" ||
    installStatus === "pending"
  ) {
    notificationStore.trigger.addNotification({
      message: "Update is already downloading in the background.",
      notificationType: "info",
    })
    return
  }

  await startPlayStoreFlexibleUpdate()
}

/**
 * Hook for managing app update checks and notifications
 */
export function useUpdateCheck(): UseUpdateCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [releaseUrl, setReleaseUrl] = useState<string | undefined>(undefined)
  const [showBanner, setShowBanner] = useState(false)
  const [installStatus, setInstallStatus] = useState<PlayStoreInstallStatus>("unknown")
  const [updateSource, setUpdateSource] = useState<UpdateSource | null>(null)
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
        setInstallStatus(updateInfo.installStatus ?? "unknown")
        setReleaseUrl(updateInfo.releaseUrl)
        setUpdateSource(updateInfo.source ?? null)

        if (bypassDismissal) {
          // Manual check - always show banner
          setShowBanner(true)
        } else {
          // Auto check - respect dismissal
          const dismissedVersion = await getDismissedVersion()
          const shouldShow = shouldShowUpdateNotification(updateInfo, dismissedVersion)
          setShowBanner(shouldShow)
        }
      } else if (updateInfo.hasUpdate) {
        setUpdateAvailable(true)
        setLatestVersion(null)
        setInstallStatus(updateInfo.installStatus ?? "unknown")
        setReleaseUrl(updateInfo.releaseUrl)
        setUpdateSource(updateInfo.source ?? null)

        if (bypassDismissal) {
          setShowBanner(true)
        } else {
          const dismissedVersion = await getDismissedVersion()
          const shouldShow = shouldShowUpdateNotification(updateInfo, dismissedVersion)
          setShowBanner(shouldShow || !updateInfo.latestVersion)
        }
      } else {
        setUpdateAvailable(false)
        setLatestVersion(null)
        setReleaseUrl(undefined)
        setInstallStatus("unknown")
        setUpdateSource(null)
        setShowBanner(false)
      }
    },
    []
  )

  useEffect(() => {
    return subscribeToPlayStoreUpdateStatus((event) => {
      setInstallStatus(event.status)

      if (event.status === "downloaded") {
        notificationStore.trigger.addNotification({
          message: "Update downloaded. Tap update again to install it.",
          notificationType: "info",
          duration: 6000,
        })
      }

      if (event.status === "failed") {
        notificationStore.trigger.addNotification({
          message: "Play Store update failed. Please try again.",
          notificationType: "error",
        })
      }
    })
  }, [])

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
   * Starts a Play Store flexible update, or installs a downloaded update
   */
  const handleUpdate = useCallback(async () => {
    try {
      await performUpdateAction({
        installStatus,
        releaseUrl,
        updateSource,
      })
    } catch (error) {
      console.error("Failed to handle update action:", error)
      notificationStore.trigger.addNotification({
        message:
          updateSource === "github"
            ? "Failed to open the release page. Please try again."
            : "Failed to start the Play Store update. Please try again.",
        notificationType: "error",
      })
    }
  }, [installStatus, releaseUrl, updateSource])

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
    isUpdateReadyToInstall: installStatus === "downloaded",
    handleUpdate,
    handleDismiss,
    checkForUpdates: manualCheckForUpdates,
  }
}
