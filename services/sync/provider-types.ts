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
  accountEmail?: string
  archiveFileName: string
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

export type RemoteRevision =
  | { kind: "git_sha"; sha: string }
  | { kind: "drive_version"; fileId: string; version: number }

export interface SyncSnapshot {
  manifest: {
    version: number
    generatedAt: string
    appVersion: string
    files: Array<{ path: string; hash: string }>
  }
  files: Record<string, string>
  remoteRevision: RemoteRevision | null
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
  readSnapshot(): Promise<SyncSnapshot | null>
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
