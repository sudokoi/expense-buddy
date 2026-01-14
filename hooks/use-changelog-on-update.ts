import { useCallback, useEffect, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Linking } from "react-native"
import { APP_CONFIG } from "../constants/app-config"
import { getReleaseForVersion } from "../services/update-checker"
import { notificationStore } from "../stores/notification-store"
import { shouldOpenChangelogModal } from "./changelog-gating"

const LAST_SEEN_CHANGELOG_VERSION_KEY = "@expense-buddy/last-seen-changelog-version"

export interface UseChangelogOnUpdateResult {
  open: boolean
  version: string
  releaseNotes: string
  releaseUrl: string
  close: () => Promise<void>
  viewFullReleaseNotes: () => Promise<void>
}

export interface UseChangelogOnUpdateOptions {
  /** Suppress showing changelog when an update is available. */
  updateAvailable: boolean
  /** Whether the update check has completed at least once this session. */
  updateCheckCompleted: boolean
}

export function useChangelogOnUpdate({
  updateAvailable,
  updateCheckCompleted,
}: UseChangelogOnUpdateOptions): UseChangelogOnUpdateResult {
  const version = APP_CONFIG.version

  const [open, setOpen] = useState(false)
  const [releaseNotes, setReleaseNotes] = useState("")
  const [releaseUrl, setReleaseUrl] = useState(`${APP_CONFIG.github.url}/releases`)

  const hasEvaluatedThisSession = useRef(false)

  const close = useCallback(async () => {
    try {
      await AsyncStorage.setItem(LAST_SEEN_CHANGELOG_VERSION_KEY, version)
    } catch (error) {
      console.warn("Failed to persist last seen changelog version:", error)
    } finally {
      setOpen(false)
    }
  }, [version])

  const viewFullReleaseNotes = useCallback(async () => {
    const url = releaseUrl

    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
        return
      }

      notificationStore.trigger.addNotification({
        message: `Could not open URL. Please visit: ${url}`,
        notificationType: "error",
        duration: 8000,
      })
    } catch (error) {
      console.error("Failed to open release notes URL:", error)
      notificationStore.trigger.addNotification({
        message: "Failed to open release notes. Please try again.",
        notificationType: "error",
      })
    }
  }, [releaseUrl])

  useEffect(() => {
    if (hasEvaluatedThisSession.current) {
      return
    }

    // Gate evaluation to after update-check completion.
    // IMPORTANT: do not mark as evaluated until the update check completes,
    // otherwise we can permanently suppress the changelog for the whole session.
    if (!updateCheckCompleted) {
      return
    }

    // Never show changelog in dev.
    if (__DEV__) {
      hasEvaluatedThisSession.current = true
      return
    }

    // Ensure we never show changelog when an update is available (update CTA takes priority).
    if (updateAvailable) {
      hasEvaluatedThisSession.current = true
      return
    }

    hasEvaluatedThisSession.current = true

    const run = async () => {
      try {
        const lastSeen = await AsyncStorage.getItem(LAST_SEEN_CHANGELOG_VERSION_KEY)

        const release = await getReleaseForVersion(version)
        const shouldOpen = shouldOpenChangelogModal({
          isDev: __DEV__,
          updateAvailable,
          updateCheckCompleted,
          currentVersion: version,
          lastSeenVersion: lastSeen,
          releaseNotes: release.releaseNotes || "",
        })
        if (!shouldOpen) return

        setReleaseNotes(release.releaseNotes)
        setReleaseUrl(
          release.releaseUrl || `${APP_CONFIG.github.url}/releases/tag/v${version}`
        )
        setOpen(true)
      } catch (error) {
        console.warn("Failed to evaluate changelog modal:", error)
      }
    }

    run()
  }, [updateAvailable, updateCheckCompleted, version])

  useEffect(() => {
    if (!open) {
      return
    }

    if (!updateAvailable) {
      return
    }

    // If update availability flips to true after we opened (rare), close and mark as seen.
    close()
  }, [open, updateAvailable, close])

  return {
    open,
    version,
    releaseNotes,
    releaseUrl,
    close,
    viewFullReleaseNotes,
  }
}
