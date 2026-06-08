export const SETTINGS_FILENAME = "settings.json"

export type SyncProviderKind = "github" | "google_drive"

export interface BaseSyncProviderConfig {
  id: string
  kind: SyncProviderKind
  label: string
  credentialId: string
}

export interface GitHubProviderConfig extends BaseSyncProviderConfig {
  kind: "github"
  repo: string
  branch: string
}

export interface GoogleDriveProviderConfig extends BaseSyncProviderConfig {
  kind: "google_drive"
  clientId: string
  tokenExchangeUrl: string
  accountEmail?: string
}

export type ProviderConfig = GitHubProviderConfig | GoogleDriveProviderConfig

export interface SyncProvidersState {
  activeProviderId: string | null
  providers: ProviderConfig[]
}

export interface CredentialEntry {
  credentialId: string
  kind: "github_pat" | "google_oauth"
  data: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface CredentialStore {
  get(credentialId: string): Promise<CredentialEntry | null>
  save(
    credentialId: string,
    entry: Omit<CredentialEntry, "createdAt" | "updatedAt">
  ): Promise<void>
  delete(credentialId: string): Promise<void>
}

export type SyncProviderErrorCode =
  | "AUTH_MISSING"
  | "AUTH_EXPIRED"
  | "AUTH_INVALID"
  | "PERMISSION_DENIED"
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK"
  | "REMOTE_ERROR"
  | "ARCHIVE_CORRUPT"
  | "ARCHIVE_TOO_LARGE"

export class SyncProviderError extends Error {
  constructor(
    readonly code: SyncProviderErrorCode,
    readonly providerKind: SyncProviderKind,
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = "SyncProviderError"
  }
}

export interface DriveYearRevision {
  /** Drive file id for expense-buddy-<year>.json */
  fileId: string
  /** Drive monotonic file version (preferred drift signal) */
  version: number
  /** Fallback signal if version is unavailable */
  contentHash?: string
}

export type RemoteRevision =
  | { kind: "git_sha"; sha: string }
  // Per-year-file revision. Maps year -> per-year revision token.
  | { kind: "drive"; fileVersions: Record<string, DriveYearRevision> }

export interface SyncSnapshot {
  manifest: {
    version: number
    generatedAt: string
    appVersion: string
    files: Array<{ path: string; hash: string }>
  }
  files: Record<string, string>
  remoteRevision: RemoteRevision | null
  /**
   * The day-key span (`yyyy-MM-dd`) covered by the FULL local/merged data this
   * snapshot was derived from — not just the changed files in `files`. Set by
   * the upload-snapshot builder so a provider's out-of-range deletion guard can
   * decide whether a deletion is inside the local data's covered range without
   * having to (incorrectly) infer the range from the upload subset alone. When
   * omitted, providers fall back to inferring the range from `files`.
   */
  coveredDayRange?: { oldest: string; newest: string } | null
}

export type ConnectionTestResult =
  | { ok: true; label: string }
  | { ok: false; error: SyncProviderError }

export interface ProviderStatus {
  connected: boolean
  lastSyncTime: string | null
}

export interface SyncProvider {
  readonly kind: SyncProviderKind
  readonly providerId: string

  testConnection(): Promise<ConnectionTestResult>

  /**
   * Fetch the FULL remote snapshot for merging. Returns null if no remote data.
   * No filterPaths: the merge must always see the complete remote snapshot.
   * Implementations MAY skip downloading prior-year files whose revision is
   * unchanged, but MUST include every year present in local data so the merge
   * is complete.
   */
  readSnapshot(): Promise<SyncSnapshot | null>
  deleteRemoteData?(): Promise<boolean>
  /**
   * Write only the changed/deleted files (upload snapshot). Performs optimistic
   * concurrency against lastKnownRevision; throws SyncProviderError(CONFLICT)
   * if the remote advanced since the snapshot was read.
   */
  writeSnapshot(
    snapshot: SyncSnapshot,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void>
  getStatus(): Promise<ProviderStatus>
}

export interface SyncProviderFactory {
  readonly kind: SyncProviderKind
  create(config: ProviderConfig): SyncProvider
}
