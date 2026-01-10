import { APP_CONFIG } from "../constants/app-config"
import { Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// AsyncStorage key for dismissed update version
const DISMISSED_VERSION_KEY = "@expense-buddy/dismissed-update-version"

// Session tracking - tracks if update check has been performed this session
let hasCheckedThisSession = false

/**
 * Reset session tracking (for testing purposes)
 */
export function resetSessionTracking(): void {
  hasCheckedThisSession = false
}

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
  error?: string
}

/**
 * Check if the app was installed from Google Play Store
 * Returns false in Expo Go since native modules aren't available
 */
export async function isPlayStoreInstall(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return false
  }

  try {
    // Dynamic import to avoid crash in Expo Go where native modules aren't available
    const DeviceInfo = await import("react-native-device-info")
    const installerPackage = await DeviceInfo.default.getInstallerPackageName()
    return installerPackage === "com.android.vending"
  } catch {
    // In Expo Go or if module fails, assume not from Play Store
    return false
  }
}

/**
 * Check if running in Expo Go (native modules not available)
 */
function isExpoGo(): boolean {
  try {
    // In Expo Go, Constants.appOwnership is 'expo'
    const Constants = require("expo-constants").default
    return Constants.appOwnership === "expo"
  } catch {
    return false
  }
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, "").split(".").map(Number)
  const parts2 = v2.replace(/^v/, "").split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0

    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }

  return 0
}

/**
 * Check for app updates from GitHub releases
 * In Expo Go, always uses GitHub check (Play Store check not available)
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = APP_CONFIG.version

  try {
    // In Expo Go, skip Play Store check and go straight to GitHub
    if (!isExpoGo()) {
      // Check if installed from Play Store (only works in standalone builds)
      const fromPlayStore = await isPlayStoreInstall()
      if (fromPlayStore) {
        // For Play Store installs, we can't check programmatically
        // Return info directing user to Play Store
        return {
          hasUpdate: false,
          currentVersion,
          releaseUrl: APP_CONFIG.playStore?.url,
          error: "Check Play Store for updates",
        }
      }
    }

    const { owner, repo } = APP_CONFIG.github
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return {
          hasUpdate: false,
          currentVersion,
          error: "No releases found",
        }
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const release = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, "")
    const releaseUrl = release.html_url
    const releaseNotes = release.body || ""

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl,
      releaseNotes,
    }
  } catch (error) {
    console.error("Update check failed:", error)
    return {
      hasUpdate: false,
      currentVersion,
      error: error instanceof Error ? error.message : "Failed to check for updates",
    }
  }
}

/**
 * Check for updates on app launch
 * Only checks once per session and skips in development mode
 * Returns null if check was skipped, otherwise returns UpdateInfo
 */
export async function checkForUpdatesOnLaunch(): Promise<UpdateInfo | null> {
  // Skip in development mode
  if (__DEV__) {
    return null
  }

  // Skip if already checked this session
  if (hasCheckedThisSession) {
    return null
  }

  // Mark as checked for this session
  hasCheckedThisSession = true

  // Perform the actual update check
  return checkForUpdates()
}

/**
 * Get the dismissed version from AsyncStorage
 * Returns null if no version has been dismissed
 */
export async function getDismissedVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DISMISSED_VERSION_KEY)
  } catch (error) {
    console.warn("Failed to get dismissed version:", error)
    return null
  }
}

/**
 * Store a dismissed version in AsyncStorage
 * This version will be skipped in future update notifications
 */
export async function setDismissedVersion(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version)
  } catch (error) {
    console.warn("Failed to set dismissed version:", error)
  }
}

/**
 * Clear the dismissed version from AsyncStorage
 * This allows the notification to show again for any version
 */
export async function clearDismissedVersion(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISSED_VERSION_KEY)
  } catch (error) {
    console.warn("Failed to clear dismissed version:", error)
  }
}

/**
 * Determine if the update notification should be shown
 * Returns true only if an update is available AND the version differs from the dismissed version
 */
export function shouldShowUpdateNotification(
  updateInfo: UpdateInfo,
  dismissedVersion: string | null
): boolean {
  // No update available - don't show notification
  if (!updateInfo.hasUpdate) {
    return false
  }

  // No latest version info - don't show notification
  if (!updateInfo.latestVersion) {
    return false
  }

  // No dismissed version - show notification
  if (!dismissedVersion) {
    return true
  }

  // Show notification only if the available version is different from dismissed
  return updateInfo.latestVersion !== dismissedVersion
}
