/**
 * Sync-related type definitions
 *
 * These types define the configuration and result structures
 * for GitHub synchronization operations.
 */

/**
 * Configuration for GitHub sync operations
 */
export interface SyncConfig {
  /** GitHub Personal Access Token */
  token: string
  /** Repository in format "owner/repo" */
  repo: string
  /** Branch name to sync with */
  branch: string
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the sync operation succeeded */
  success: boolean
  /** Human-readable message describing the result */
  message: string
  /** Error message if the operation failed */
  error?: string

  /** HTTP status when auth/permission errors occur (GitHub) */
  authStatus?: 401 | 403
  /** Whether the app should clear saved sync config and prompt re-login */
  shouldSignOut?: boolean
  /** Number of files uploaded during sync */
  filesUploaded?: number
  /** Number of files skipped (unchanged) during sync */
  filesSkipped?: number
  /** Number of files deleted during sync */
  filesDeleted?: number
  /** Number of local files updated during sync (uploads + deletions) */
  localFilesUpdated?: number
  /** Number of remote files updated during sync (downloads) */
  remoteFilesUpdated?: number
  /** Whether settings were synced */
  settingsSynced?: boolean
  /** Whether settings sync was skipped (unchanged) */
  settingsSkipped?: boolean
  /** Error message if settings sync failed */
  settingsError?: string
  /** Timestamp of the commit if one was created */
  commitTimestamp?: string
}

/**
 * Notification data for sync operations
 */
export interface SyncNotification {
  /** Number of local files updated during sync */
  localFilesUpdated: number
  /** Number of remote files updated during sync */
  remoteFilesUpdated: number
  /** Human-readable notification message */
  message: string
}

/**
 * Sync direction types for the unified sync button
 */
export type SyncDirection = "push" | "pull" | "conflict" | "in_sync" | "error"

/**
 * Result of determining sync direction
 */
export interface SyncDirectionResult {
  /** The determined sync direction */
  direction: SyncDirection
  /** Local last sync timestamp */
  localTime: string | null
  /** Remote last modified timestamp */
  remoteTime: string | null
  /** Error message if direction could not be determined */
  error?: string
}

/**
 * Result of fetching all remote expenses
 */
export interface FetchAllRemoteResult {
  /** Whether the fetch operation succeeded */
  success: boolean
  /** The fetched expenses (only present on success) */
  expenses?: import("./expense").Expense[]
  /** Error message if the operation failed */
  error?: string

  /** HTTP status when auth/permission errors occur (GitHub) */
  authStatus?: 401 | 403
  /** Whether the app should clear saved sync config and prompt re-login */
  shouldSignOut?: boolean
  /** Number of files downloaded */
  filesDownloaded?: number
}
