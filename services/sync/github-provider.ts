import type { GitHubProviderConfig } from "./provider-types"
import type {
  SyncProvider,
  SyncSnapshot,
  RemoteRevision,
  ConnectionTestResult,
  ProviderStatus,
  CredentialStore,
  SyncProviderError,
} from "./provider-types"
import { SyncProviderError as SyncProviderErrorClass } from "./provider-types"
import {
  getRepositoryTree,
  downloadCSV,
  downloadSettingsFile,
  batchCommit,
  validatePAT,
  GitHubApiError,
  type BatchCommitRequest,
} from "../github-sync"
import { getDayKeyFromFilename } from "../daily-file-manager"

const SETTINGS_FILENAME = "settings.json"

export class GitHubProvider implements SyncProvider {
  readonly kind = "github" as const
  readonly providerId: string

  private config: GitHubProviderConfig
  private credentialStore: CredentialStore

  constructor(config: GitHubProviderConfig, credentialStore: CredentialStore) {
    this.providerId = config.id
    this.config = config
    this.credentialStore = credentialStore
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const token = await this.getToken()
    if (!token) {
      return { ok: false, error: this.authError("AUTH_MISSING") }
    }

    try {
      const result = await validatePAT(token, this.config.repo)
      if (result.valid) {
        return { ok: true, label: this.config.repo }
      }
      const code =
        result.authStatus === 401 || result.authStatus === 403
          ? ("AUTH_INVALID" as const)
          : ("PERMISSION_DENIED" as const)
      return {
        ok: false,
        error: new SyncProviderErrorClass(
          code,
          "github",
          result.error ?? "Connection failed",
          false
        ),
      }
    } catch (error) {
      return {
        ok: false,
        error: this.toProviderError(error),
      }
    }
  }

  async readSnapshot(): Promise<SyncSnapshot | null> {
    const token = await this.getToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const treeResult = await getRepositoryTree(
      token,
      this.config.repo,
      this.config.branch
    )
    if (!treeResult.success) {
      if (treeResult.authStatus) {
        throw new SyncProviderErrorClass(
          "AUTH_INVALID",
          "github",
          treeResult.error ?? "Auth failed",
          false
        )
      }
      return null
    }

    const expenseEntries = treeResult.entries.filter(
      (e) => e.type === "blob" && getDayKeyFromFilename(e.path) !== null
    )
    const settingsEntry = treeResult.entries.find((e) => e.path === SETTINGS_FILENAME)

    if (expenseEntries.length === 0 && !settingsEntry) {
      return null
    }

    const files: Record<string, string> = {}

    for (const entry of expenseEntries) {
      try {
        const fileData = await downloadCSV(
          token,
          this.config.repo,
          this.config.branch,
          entry.path
        )
        if (fileData) {
          files[entry.path] = fileData.content
        }
      } catch {
        continue
      }
    }

    if (settingsEntry) {
      try {
        const settingsData = await downloadSettingsFile(
          token,
          this.config.repo,
          this.config.branch
        )
        if (settingsData) {
          files[SETTINGS_FILENAME] = settingsData.content
        }
      } catch {
        // settings file is optional
      }
    }

    const fileList = Object.entries(files).map(([path, content]) => ({
      path,
      hash: simpleHash(content),
    }))

    const remoteRevision: RemoteRevision = {
      kind: "git_sha",
      sha: treeResult.treeSha,
    }

    return {
      manifest: {
        version: 1,
        generatedAt: new Date().toISOString(),
        appVersion: "1.0.0",
        files: fileList,
      },
      files,
      remoteRevision,
    }
  }

  async writeSnapshot(
    snapshot: SyncSnapshot,
    _lastKnownRevision: RemoteRevision | null
  ): Promise<void> {
    const token = await this.getToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const uploads: { path: string; content: string }[] = []
    const deletions: { path: string }[] = []

    for (const [path, content] of Object.entries(snapshot.files)) {
      if (content.length === 0) {
        deletions.push({ path })
      } else {
        uploads.push({ path, content })
      }
    }

    const commitRequest: BatchCommitRequest = {
      uploads,
      deletions,
      message: generateCommitMessage(uploads.length, deletions.length),
    }

    const result = await batchCommit(
      token,
      this.config.repo,
      this.config.branch,
      commitRequest
    )

    if (!result.success) {
      const code = mapBatchErrorCode(result.errorCode)
      const retryable =
        code === "CONFLICT" || code === "RATE_LIMITED" || code === "NETWORK"
      throw new SyncProviderErrorClass(
        code,
        "github",
        result.error ?? "Write failed",
        retryable
      )
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const token = await this.getToken()
    if (!token) {
      return { connected: false, lastSyncTime: null }
    }

    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      })
      return { connected: response.ok, lastSyncTime: null }
    } catch {
      return { connected: false, lastSyncTime: null }
    }
  }

  private async getToken(): Promise<string | null> {
    const entry = await this.credentialStore.get(this.config.credentialId)
    if (!entry) return null
    return entry.data["token"] ?? null
  }

  private authError(code: SyncProviderError["code"]): SyncProviderError {
    return new SyncProviderErrorClass(code, "github", `${code}`, false)
  }

  private toProviderError(error: unknown): SyncProviderError {
    if (error instanceof SyncProviderErrorClass) return error
    if (error instanceof GitHubApiError) {
      if (error.isRateLimit) {
        return new SyncProviderErrorClass("RATE_LIMITED", "github", error.message, true)
      }
      if (error.status === 401) {
        return new SyncProviderErrorClass("AUTH_INVALID", "github", error.message, false)
      }
      if (error.status === 403) {
        return new SyncProviderErrorClass(
          "PERMISSION_DENIED",
          "github",
          error.message,
          false
        )
      }
      return new SyncProviderErrorClass("REMOTE_ERROR", "github", error.message, true)
    }
    const msg = String(error)
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("Network request failed") ||
      msg.includes("TypeError")
    ) {
      return new SyncProviderErrorClass("NETWORK", "github", msg, true)
    }
    return new SyncProviderErrorClass("REMOTE_ERROR", "github", msg, true)
  }
}

function simpleHash(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16)
}

function generateCommitMessage(uploads: number, deletions: number): string {
  const parts: string[] = []
  if (uploads > 0) parts.push(`${uploads} file${uploads > 1 ? "s" : ""} updated`)
  if (deletions > 0) parts.push(`${deletions} file${deletions > 1 ? "s" : ""} deleted`)
  if (parts.length === 0) return `Sync expenses - ${new Date().toISOString()}`
  return `Sync expenses: ${parts.join(", ")} - ${new Date().toISOString()}`
}

function mapBatchErrorCode(code: string | undefined): SyncProviderError["code"] {
  switch (code) {
    case "AUTH":
      return "AUTH_INVALID"
    case "PERMISSION":
      return "PERMISSION_DENIED"
    case "NOT_FOUND":
      return "NOT_FOUND"
    case "CONFLICT":
      return "CONFLICT"
    case "RATE_LIMIT":
      return "RATE_LIMITED"
    default:
      return "REMOTE_ERROR"
  }
}
