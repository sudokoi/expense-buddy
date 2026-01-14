import { APP_CONFIG } from "../constants/app-config"
import { Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { extractChangelogSection } from "./changelog-parser"

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
  publishedAt?: string
  error?: string
}

export interface ReleaseNotesInfo {
  version: string
  tag: string
  releaseUrl?: string
  releaseNotes: string
  publishedAt?: string
  error?: string
}

// Minimum time (in ms) since release before showing update notification for Play Store installs
// This gives time for the release to propagate to Play Store
const PLAY_STORE_DELAY_MS = 60 * 60 * 1000 // 1 hour

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
 * Check if a release is old enough to be available on Play Store
 * Returns true if the release was published more than PLAY_STORE_DELAY_MS ago
 */
export function isReleaseOldEnough(publishedAt: string, now: Date = new Date()): boolean {
  const releaseDate = new Date(publishedAt)
  const timeSinceRelease = now.getTime() - releaseDate.getTime()
  return timeSinceRelease >= PLAY_STORE_DELAY_MS
}

/**
 * Check for app updates from GitHub releases
 * Uses GitHub as the source of truth for version info.
 * For Play Store installs, applies a delay to ensure the update is available on Play Store.
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = APP_CONFIG.version

  try {
    // Determine if this is a Play Store install (for URL override and delay logic)
    const fromPlayStore = !isExpoGo() && (await isPlayStoreInstall())

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
    const releaseNotes = release.body || ""
    const publishedAt = release.published_at || ""

    // Determine if there's a newer version
    const isNewerVersion = compareVersions(latestVersion, currentVersion) > 0

    // For Play Store installs, only show update if release is old enough
    // This gives time for the release to propagate to Play Store
    // If publishedAt is missing, be conservative and don't show the update
    let hasUpdate = isNewerVersion
    if (fromPlayStore && isNewerVersion) {
      hasUpdate = publishedAt ? isReleaseOldEnough(publishedAt) : false
    }

    // Use Play Store URL for Play Store installs, GitHub URL otherwise
    const releaseUrl = fromPlayStore ? APP_CONFIG.playStore?.url : release.html_url

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl,
      releaseNotes,
      publishedAt,
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

async function fetchReleaseByTag(tag: string): Promise<any | null> {
  const { owner, repo } = APP_CONFIG.github
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(
    tag
  )}`

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return response.json()
}

async function fetchChangelogMarkdownAtRef(ref: string): Promise<string | null> {
  const { owner, repo } = APP_CONFIG.github
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(
    ref
  )}/CHANGELOG.md`

  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
    },
  })

  if (!response.ok) {
    return null
  }

  return response.text()
}

async function fetchDefaultBranchChangelogMarkdown(): Promise<string | null> {
  const { owner, repo } = APP_CONFIG.github

  // Fetch default branch name (robust to main/master changes)
  try {
    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })
    if (repoResp.ok) {
      const data = await repoResp.json()
      const branch = typeof data?.default_branch === "string" ? data.default_branch : null
      if (branch) {
        const md = await fetchChangelogMarkdownAtRef(branch)
        if (md) return md
      }
    }
  } catch {
    // fall through
  }

  // Conservative fallback candidates
  return (
    (await fetchChangelogMarkdownAtRef("main")) ??
    (await fetchChangelogMarkdownAtRef("master"))
  )
}

/**
 * Fetch release notes for a specific app version.
 *
 * Tries tag `v{version}` first, then falls back to `{version}`.
 * Returns empty releaseNotes if the release/tag is not found or on error.
 */
export async function getReleaseForVersion(version: string): Promise<ReleaseNotesInfo> {
  const normalizedVersion = version.replace(/^v/, "")

  const candidateTags = [`v${normalizedVersion}`, normalizedVersion]
  for (const tag of candidateTags) {
    try {
      const [release, changelogMarkdown] = await Promise.all([
        fetchReleaseByTag(tag),
        fetchChangelogMarkdownAtRef(tag),
      ])

      const releaseUrl = release?.html_url
      const publishedAt = release?.published_at || ""
      const releaseNotes = changelogMarkdown
        ? extractChangelogSection(changelogMarkdown, normalizedVersion)
        : ""

      if (releaseNotes.trim()) {
        return {
          version: normalizedVersion,
          tag,
          releaseUrl:
            releaseUrl ||
            `${APP_CONFIG.github.url}/releases/tag/${encodeURIComponent(tag)}`,
          releaseNotes,
          publishedAt,
        }
      }
    } catch {
      // Never fail hard: missing releases/CHANGELOG, rate limits, network errors, etc.
      // The UI gates on releaseNotes being non-empty, so returning empty is safe.
      continue
    }
  }

  // Fallback: fetch CHANGELOG.md from the default branch and extract the section.
  try {
    const changelogMarkdown = await fetchDefaultBranchChangelogMarkdown()
    const releaseNotes = changelogMarkdown
      ? extractChangelogSection(changelogMarkdown, normalizedVersion)
      : ""

    if (releaseNotes.trim()) {
      return {
        version: normalizedVersion,
        tag: `v${normalizedVersion}`,
        releaseUrl: `${APP_CONFIG.github.url}/releases/tag/${encodeURIComponent(`v${normalizedVersion}`)}`,
        releaseNotes,
      }
    }
  } catch {
    // fall through
  }

  // Not found
  return {
    version: normalizedVersion,
    tag: `v${normalizedVersion}`,
    releaseUrl: `${APP_CONFIG.github.url}/releases/tag/${encodeURIComponent(`v${normalizedVersion}`)}`,
    releaseNotes: "",
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
