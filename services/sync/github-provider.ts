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
  generateCommitMessage,
  type BatchCommitRequest,
} from "../github-sync"
import { getDayKeyFromFilename } from "../daily-file-manager"
import { simpleHash, applyDeletionRangeGuard } from "./sync-utils"
import { SETTINGS_FILENAME } from "./provider-types"
import { APP_CONFIG } from "../../constants/app-config"

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
    const startTime = Date.now()
    const token = await this.getToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const controller = new AbortController()
    const abortTimeout = setTimeout(() => controller.abort(), 25000)
    const signal = controller.signal

    try {
      console.warn(
        `GitHubProvider: readSnapshot - fetching tree for ${this.config.repo}/${this.config.branch}`
      )

      const treeResult = await getRepositoryTree(
        token,
        this.config.repo,
        this.config.branch,
        signal
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
        console.warn(
          `GitHubProvider: readSnapshot - no matching files found in repo (took ${Date.now() - startTime}ms)`
        )
        return null
      }

      const files: Record<string, string> = {}

      let failedDownloads = 0

      console.warn(
        `GitHubProvider: readSnapshot - downloading ${expenseEntries.length} expense file(s)`
      )

      for (const entry of expenseEntries) {
        try {
          const fileData = await downloadCSV(
            token,
            this.config.repo,
            this.config.branch,
            entry.path,
            signal
          )
          if (fileData) {
            files[entry.path] = fileData.content
          }
        } catch {
          failedDownloads++
        }
      }

      if (failedDownloads > 0) {
        console.warn(
          `GitHubProvider: ${failedDownloads} file(s) failed to download during readSnapshot`
        )
      }

      if (settingsEntry) {
        try {
          const settingsData = await downloadSettingsFile(
            token,
            this.config.repo,
            this.config.branch,
            signal
          )
          if (settingsData) {
            files[SETTINGS_FILENAME] = settingsData.content
          }
        } catch {
          console.warn("GitHubProvider: failed to download settings file")
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

      console.warn(
        `GitHubProvider: readSnapshot - completed (${Object.keys(files).length} files, took ${Date.now() - startTime}ms)`
      )

      return {
        manifest: {
          version: 1,
          generatedAt: new Date().toISOString(),
          appVersion: APP_CONFIG.version,
          files: fileList,
        },
        files,
        remoteRevision,
      }
    } finally {
      clearTimeout(abortTimeout)
    }
  }

  async writeSnapshot(
    snapshot: SyncSnapshot,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void> {
    const startTime = Date.now()
    const token = await this.getToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const controller = new AbortController()
    const abortTimeout = setTimeout(() => controller.abort(), 25000)
    const signal = controller.signal

    try {
      // Optimistic concurrency (Requirements 6.1, 6.2): re-read the current
      // branch/tree SHA and compare it against the git_sha captured when this
      // cycle's snapshot was read. If the remote tree advanced, abort with
      // CONFLICT and leave the remote untouched so the orchestrator re-reads
      // and re-merges instead of clobbering the newer remote state.
      if (lastKnownRevision?.kind === "git_sha") {
        const head = await getRepositoryTree(
          token,
          this.config.repo,
          this.config.branch,
          signal
        )
        if (head.success) {
          if (head.treeSha !== lastKnownRevision.sha) {
            throw new SyncProviderErrorClass(
              "CONFLICT",
              "github",
              "Remote advanced since last read",
              false
            )
          }
        } else {
          // We held a known revision but could not re-read the remote to verify
          // it is unchanged. Rather than write blind (and risk clobbering a
          // concurrent change), fail the write as a retryable NETWORK error so
          // the orchestrator re-reads/re-merges and retries.
          throw new SyncProviderErrorClass(
            "NETWORK",
            "github",
            "Could not verify remote state before write",
            true
          )
        }
      }

      // Out-of-range deletion guard (Requirement 6.3, restored from main): never
      // delete a remote day file that falls outside the covered date range of
      // the local data. The range is taken from the snapshot's coveredDayRange
      // (the FULL local/merged data span) when present; otherwise it is inferred
      // from the snapshot's own content files as a fallback.
      const safeFiles = applyDeletionRangeGuard(snapshot.files, snapshot.coveredDayRange)

      const uploads: { path: string; content: string }[] = []
      const deletions: { path: string }[] = []

      for (const [path, content] of Object.entries(safeFiles)) {
        if (content.length === 0) {
          deletions.push({ path })
        } else {
          uploads.push({ path, content })
        }
      }

      console.warn(
        `GitHubProvider: writeSnapshot - uploading ${uploads.length} file(s), deleting ${deletions.length} file(s)`
      )

      const commitRequest: BatchCommitRequest = {
        uploads,
        deletions,
        message: generateCommitMessage(uploads.length, deletions.length),
      }

      const result = await batchCommit(
        token,
        this.config.repo,
        this.config.branch,
        commitRequest,
        signal
      )

      if (!result.success) {
        const code = mapBatchErrorCode(result.errorCode)
        // CONFLICT is never auto-retried on write: it is resolved by a full
        // re-read + re-merge and an explicit user-initiated push (Req 6.6, 6.7).
        // Only transient transport failures are retryable.
        const retryable = code === "RATE_LIMITED" || code === "NETWORK"
        throw new SyncProviderErrorClass(
          code,
          "github",
          result.error ?? "Write failed",
          retryable
        )
      }

      console.warn(
        `GitHubProvider: writeSnapshot - completed (took ${Date.now() - startTime}ms)`
      )
    } finally {
      clearTimeout(abortTimeout)
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
    if (error instanceof Error && error.name === "AbortError") {
      return new SyncProviderErrorClass(
        "NETWORK",
        "github",
        "Request timed out after 25 seconds",
        true
      )
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
