import type { GoogleDriveProviderConfig } from "./provider-types"
import type {
  SyncProvider,
  SyncSnapshot,
  RemoteRevision,
  DriveYearRevision,
  ConnectionTestResult,
  ProviderStatus,
  CredentialStore,
  SyncProviderError,
} from "./provider-types"
import { SyncProviderError as SyncProviderErrorClass } from "./provider-types"
import { simpleHash } from "./sync-utils"
import { APP_CONFIG } from "../../constants/app-config"
import { Platform } from "react-native"
import { logAsync } from "../logger"

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3"
const YEAR_FILE_PREFIX = "expense-buddy-"
const YEAR_FILE_SUFFIX = ".json"

interface DriveFileMetadata {
  id: string
  name: string
  version: number
  modifiedTime: string
}

interface YearFileData {
  v: number
  f: Record<string, string>
}

/**
 * Provider-scoped cache port for the per-year revision index and parsed year
 * bodies. It backs the `readSnapshot` version preflight: when a year file's
 * Drive `version` is unchanged AND usable cached content exists, the download
 * is skipped (Requirement 7.3). When the cache is missing or unavailable the
 * provider downloads the year file even if the version matches (Requirement
 * 7.6).
 *
 * The implementation is wired to provider-scoped metadata
 * (`sync.providers.<providerId>.remoteIndex`) in a later task; until then the
 * provider operates without a cache and always downloads (always-correct, just
 * not bandwidth-optimal).
 */
export interface DriveYearCache {
  /** Per-year revision index keyed by year string (e.g. "2025"). */
  loadIndex(): Promise<Record<string, DriveYearRevision>>
  /**
   * Parsed `path -> content` map cached for a year, or null when no usable
   * cached content exists for that year.
   */
  readYear(year: string): Promise<Record<string, string> | null>
  /** Persist parsed content + revision for a year after a download. */
  saveYear(
    year: string,
    files: Record<string, string>,
    revision: DriveYearRevision
  ): Promise<void>
}

export class GoogleDriveProvider implements SyncProvider {
  readonly kind = "google_drive" as const
  readonly providerId: string

  private config: GoogleDriveProviderConfig
  private credentialStore: CredentialStore
  private yearCache: DriveYearCache | null

  constructor(
    config: GoogleDriveProviderConfig,
    credentialStore: CredentialStore,
    yearCache?: DriveYearCache
  ) {
    this.providerId = config.id
    this.config = config
    this.credentialStore = credentialStore
    this.yearCache = yearCache ?? null
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (Platform.OS !== "android") {
      return {
        ok: false,
        error: new SyncProviderErrorClass(
          "REMOTE_ERROR",
          "google_drive",
          "Google Drive sync is only available on Android",
          false
        ),
      }
    }

    const token = await this.getAccessToken()
    if (!token) {
      return { ok: false, error: this.authError("AUTH_MISSING") }
    }

    try {
      const response = await fetch(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&pageSize=1&fields=files(id)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (!response.ok) {
        return {
          ok: false,
          error: this.mapHttpError(response.status, "Connection test failed"),
        }
      }

      return { ok: true, label: "Google Drive (appDataFolder)" }
    } catch (error) {
      return { ok: false, error: this.toProviderError(error) }
    }
  }

  /**
   * Fetch the FULL remote snapshot for merging (no filterPaths). Lists the
   * per-year JSON files in `appDataFolder` and, for each year, runs a version
   * preflight: a download is skipped only when the Drive `version` matches the
   * cached per-year revision AND usable cached content exists for that year
   * (Requirement 7.3). Otherwise the year file is downloaded — including when
   * the cache is missing even though the version matches (Requirement 7.6).
   * The returned snapshot covers every year present remotely so the merge sees
   * the complete remote set (Requirement 7.2), and carries a per-year
   * `RemoteRevision` index.
   */
  async readSnapshot(): Promise<SyncSnapshot | null> {
    const startTime = Date.now()
    if (Platform.OS !== "android") {
      throw new SyncProviderErrorClass(
        "REMOTE_ERROR",
        "google_drive",
        "Google Drive sync is only available on Android",
        false
      )
    }

    const token = await this.getAccessToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const yearFiles = await this.listYearFiles(token)
    logAsync("INFO", "DRIVE_PROVIDER", `readSnapshot yearFiles=${yearFiles.length}`)
    if (yearFiles.length === 0) return null

    const cachedIndex = await this.loadRemoteIndex()
    const files: Record<string, string> = {}
    const fileVersions: Record<string, DriveYearRevision> = {}
    let skippedYears = 0

    for (const file of yearFiles) {
      const year = this.parseYearFromName(file.name)
      if (year === null) continue

      const cached = cachedIndex[year]

      // PREFLIGHT: skip the download only when the Drive version is unchanged
      // AND usable cached content for that year is present. A missing/unusable
      // cache falls through to a download even when the version matches.
      if (cached && cached.version === file.version) {
        const cachedFiles = await this.readCachedYear(year)
        if (cachedFiles) {
          Object.assign(files, cachedFiles)
          fileVersions[year] = {
            fileId: file.id,
            version: file.version,
            contentHash: cached.contentHash,
          }
          skippedYears++
          continue
        }
      }

      const content = await this.downloadFile(token, file.id)
      if (!content) continue

      const parsed = this.parseYearFile(content)
      const revision: DriveYearRevision = {
        fileId: file.id,
        version: file.version,
        contentHash: simpleHash(content),
      }
      fileVersions[year] = revision
      Object.assign(files, parsed.f)
      await this.saveCachedYear(year, parsed.f, revision)
    }

    logAsync(
      "INFO",
      "DRIVE_PROVIDER",
      `readSnapshot years=${yearFiles.length} skipped=${skippedYears}`
    )

    if (Object.keys(files).length === 0) return null

    const fileList = Object.entries(files).map(([path, content]) => ({
      path,
      hash: simpleHash(content),
    }))

    const snapshot: SyncSnapshot = {
      manifest: {
        version: 1,
        generatedAt: new Date().toISOString(),
        appVersion: APP_CONFIG.version,
        files: fileList,
      },
      files,
      remoteRevision: { kind: "drive", fileVersions },
    }

    logAsync(
      "INFO",
      "DRIVE_PROVIDER",
      `readSnapshot completed took=${Date.now() - startTime}ms`
    )

    return snapshot
  }

  async deleteRemoteData(): Promise<boolean> {
    if (Platform.OS !== "android") {
      throw new SyncProviderErrorClass(
        "REMOTE_ERROR",
        "google_drive",
        "Google Drive sync is only available on Android",
        false
      )
    }

    const token = await this.getAccessToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const yearFiles = await this.listYearFiles(token)
    if (yearFiles.length === 0) return false

    for (const file of yearFiles) {
      await this.deleteFile(token, file.id)
    }

    return true
  }

  async writeSnapshot(
    snapshot: SyncSnapshot,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void> {
    const startTime = Date.now()
    if (Platform.OS !== "android") {
      throw new SyncProviderErrorClass(
        "REMOTE_ERROR",
        "google_drive",
        "Google Drive sync is only available on Android",
        false
      )
    }

    const token = await this.getAccessToken()
    if (!token) throw this.authError("AUTH_MISSING")

    const currentYear = new Date().getFullYear()
    const filesByYear = this.groupFilesByYear(snapshot.files, currentYear)

    logAsync(
      "INFO",
      "DRIVE_PROVIDER",
      `writeSnapshot years=${Object.keys(filesByYear).length} totalFiles=${Object.keys(snapshot.files).length}`
    )

    for (const [yearStr, changedFiles] of Object.entries(filesByYear)) {
      const fileName = this.yearFileName(parseInt(yearStr, 10))
      const existingFile = await this.findFileByName(token, fileName)

      // PREFLIGHT optimistic concurrency (Req 6.4, 6.5): for an existing year
      // file, re-read the current Drive `version` and compare it against the
      // version captured at cycle start. If it advanced (another device wrote
      // the year file since our read), throw CONFLICT and leave the year file
      // unchanged. The numeric `version` is the preferred drift signal.
      if (
        existingFile &&
        lastKnownRevision?.kind === "drive" &&
        lastKnownRevision.fileVersions
      ) {
        const known = lastKnownRevision.fileVersions[yearStr]
        if (known) {
          const currentVersion = await this.getFileVersion(token, existingFile.id)
          if (currentVersion !== null && currentVersion !== known.version) {
            throw new SyncProviderErrorClass(
              "CONFLICT",
              "google_drive",
              `Year file ${yearStr} was modified by another device since last read`,
              false
            )
          }
        }
      }

      const existingContent = existingFile
        ? await this.downloadFile(token, existingFile.id)
        : null

      const yearData: YearFileData = existingContent
        ? this.parseYearFile(existingContent)
        : { v: 1, f: {} }

      // Merge changed day files into the year body. An empty-string content is
      // a deletion: the day is removed from the year body (Req 7.5).
      for (const [path, content] of Object.entries(changedFiles)) {
        if (content.length === 0) {
          delete yearData.f[path]
        } else {
          yearData.f[path] = content
        }
      }

      const hasEntries = Object.keys(yearData.f).length > 0
      const body = JSON.stringify(yearData)

      if (existingFile) {
        if (hasEntries) {
          const newVersion = await this.updateFile(token, existingFile.id, body)
          await this.saveCachedYear(yearStr, yearData.f, {
            fileId: existingFile.id,
            version: newVersion ?? existingFile.version,
            contentHash: simpleHash(body),
          })
        } else {
          // The year body became empty: delete the Drive file (Req 7.5). The
          // delete is BEST-EFFORT (Req 7.7) — if it fails, log it, leave the
          // empty file in place, and do NOT fail the sync.
          try {
            await this.deleteFile(token, existingFile.id)
          } catch (error) {
            logAsync(
              "WARN",
              "DRIVE_PROVIDER",
              `writeSnapshot failed to delete empty year file ${fileName}; leaving it in place: ${String(error)}`
            )
          }
        }
      } else if (hasEntries) {
        const created = await this.createFile(token, fileName, body)
        if (created) {
          await this.saveCachedYear(yearStr, yearData.f, {
            fileId: created.id,
            version: created.version ?? 1,
            contentHash: simpleHash(body),
          })
        }
      }
    }

    logAsync(
      "INFO",
      "DRIVE_PROVIDER",
      `writeSnapshot completed took=${Date.now() - startTime}ms`
    )
  }

  async getStatus(): Promise<ProviderStatus> {
    if (Platform.OS !== "android") {
      return { connected: false, lastSyncTime: null }
    }

    const token = await this.getAccessToken()
    if (!token) {
      return { connected: false, lastSyncTime: null }
    }

    try {
      const response = await fetch(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&pageSize=1&fields=files(id,modifiedTime)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )
      return { connected: response.ok, lastSyncTime: null }
    } catch {
      return { connected: false, lastSyncTime: null }
    }
  }

  private yearFileName(year: number): string {
    return `${YEAR_FILE_PREFIX}${year}${YEAR_FILE_SUFFIX}`
  }

  /**
   * Extract the 4-digit year from a year file name (e.g.
   * `expense-buddy-2025.json` -> "2025"). Returns null for names that don't
   * match the expected pattern.
   */
  private parseYearFromName(name: string): string | null {
    if (!name.startsWith(YEAR_FILE_PREFIX) || !name.endsWith(YEAR_FILE_SUFFIX)) {
      return null
    }
    const year = name.slice(YEAR_FILE_PREFIX.length, -YEAR_FILE_SUFFIX.length)
    return /^\d{4}$/.test(year) ? year : null
  }

  /**
   * Load the cached per-year revision index. Cache failures are swallowed and
   * treated as an empty index, forcing downloads (always-correct fallback).
   */
  private async loadRemoteIndex(): Promise<Record<string, DriveYearRevision>> {
    if (!this.yearCache) return {}
    try {
      return await this.yearCache.loadIndex()
    } catch (error) {
      logAsync("WARN", "DRIVE_PROVIDER", `loadRemoteIndex failed: ${String(error)}`)
      return {}
    }
  }

  /**
   * Read usable cached content for a year, or null when the cache is missing or
   * unavailable (Requirement 7.6 — caller then downloads even on a version
   * match).
   */
  private async readCachedYear(year: string): Promise<Record<string, string> | null> {
    if (!this.yearCache) return null
    try {
      return await this.yearCache.readYear(year)
    } catch (error) {
      logAsync(
        "WARN",
        "DRIVE_PROVIDER",
        `readCachedYear ${year} failed: ${String(error)}`
      )
      return null
    }
  }

  /** Persist parsed content + revision for a year after a download (best-effort). */
  private async saveCachedYear(
    year: string,
    files: Record<string, string>,
    revision: DriveYearRevision
  ): Promise<void> {
    if (!this.yearCache) return
    try {
      await this.yearCache.saveYear(year, files, revision)
    } catch (error) {
      logAsync(
        "WARN",
        "DRIVE_PROVIDER",
        `saveCachedYear ${year} failed: ${String(error)}`
      )
    }
  }

  private getYearForPath(path: string, currentYear: number): number {
    const match = path.match(/(\d{4})-\d{2}-\d{2}\.csv$/)
    return match ? parseInt(match[1], 10) : currentYear
  }

  private groupFilesByYear(
    files: Record<string, string>,
    currentYear: number
  ): Record<string, Record<string, string>> {
    const grouped: Record<string, Record<string, string>> = {}
    for (const [path, content] of Object.entries(files)) {
      const year = String(this.getYearForPath(path, currentYear))
      if (!grouped[year]) grouped[year] = {}
      grouped[year][path] = content
    }
    return grouped
  }

  private async listYearFiles(token: string): Promise<DriveFileMetadata[]> {
    try {
      const encodedPrefix = encodeURIComponent(YEAR_FILE_PREFIX)
      const response = await fetch(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=name contains '${encodedPrefix}'&fields=files(id,name,version,modifiedTime)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (!response.ok) {
        throw this.mapHttpError(response.status, "Failed to list files")
      }

      const data = await response.json()
      const files: DriveFileMetadata[] = data.files ?? []
      return files.filter(
        (f) => f.name.startsWith(YEAR_FILE_PREFIX) && f.name.endsWith(YEAR_FILE_SUFFIX)
      )
    } catch (error) {
      if (error instanceof SyncProviderErrorClass) throw error
      throw this.toProviderError(error)
    }
  }

  private async findFileByName(
    token: string,
    name: string
  ): Promise<DriveFileMetadata | null> {
    try {
      const encodedName = encodeURIComponent(name)
      const response = await fetch(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=name='${encodedName}'&fields=files(id,name,version,modifiedTime)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (!response.ok) {
        throw this.mapHttpError(response.status, "Failed to list files")
      }

      const data = await response.json()
      const files: DriveFileMetadata[] = data.files ?? []
      return files.length > 0 ? files[0] : null
    } catch (error) {
      if (error instanceof SyncProviderErrorClass) throw error
      throw this.toProviderError(error)
    }
  }

  private async downloadFile(token: string, fileId: string): Promise<string | null> {
    try {
      const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw this.mapHttpError(response.status, "Failed to download file")
      }

      return await response.text()
    } catch (error) {
      if (error instanceof SyncProviderErrorClass) throw error
      throw this.toProviderError(error)
    }
  }

  private parseYearFile(content: string): YearFileData {
    if (!content || content.trim().length === 0) {
      return { v: 1, f: {} }
    }
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === "object" && parsed.v === 1 && parsed.f) {
        return parsed as YearFileData
      }
      return { v: 1, f: {} }
    } catch {
      throw new SyncProviderErrorClass(
        "ARCHIVE_CORRUPT",
        "google_drive",
        "Year file is corrupted",
        false
      )
    }
  }

  private async createFile(
    token: string,
    fileName: string,
    body: string
  ): Promise<{ id: string; version: number | null } | null> {
    const boundary = `boundary_${Date.now()}`
    const metadata = JSON.stringify({
      name: fileName,
      parents: ["appDataFolder"],
      mimeType: "application/json",
    })

    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      body,
      `--${boundary}--`,
    ].join("\r\n")

    const response = await fetch(
      `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,version`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    )

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to create file")
    }

    try {
      const data = await response.json()
      return { id: data?.id ?? "", version: this.parseVersion(data?.version) }
    } catch {
      return null
    }
  }

  private async updateFile(
    token: string,
    fileId: string,
    body: string
  ): Promise<number | null> {
    const response = await fetch(
      `${UPLOAD_API_BASE}/files/${fileId}?uploadType=media&fields=version`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      }
    )

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to update file")
    }

    try {
      const data = await response.json()
      return this.parseVersion(data?.version)
    } catch {
      return null
    }
  }

  /**
   * Read the current Drive `version` for a file via `files.get?fields=version`.
   * Used for the write-time optimistic-concurrency preflight (Req 6.4, 6.5).
   * Drive may serialize the int64 `version` as a string, so both shapes are
   * accepted. Returns null when the version cannot be determined.
   */
  private async getFileVersion(token: string, fileId: string): Promise<number | null> {
    try {
      const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=version`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw this.mapHttpError(response.status, "Failed to read file version")
      }

      const data = await response.json()
      return this.parseVersion(data?.version)
    } catch (error) {
      if (error instanceof SyncProviderErrorClass) throw error
      throw this.toProviderError(error)
    }
  }

  private parseVersion(value: unknown): number | null {
    if (typeof value === "number") return value
    if (typeof value === "string") {
      const parsed = parseInt(value, 10)
      return Number.isNaN(parsed) ? null : parsed
    }
    return null
  }

  private async deleteFile(token: string, fileId: string): Promise<void> {
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to delete file")
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const entry = await this.credentialStore.get(this.config.credentialId)
    if (!entry) return null

    const accessToken = entry.data["access_token"]
    if (!accessToken) return null

    const expiresAt = entry.data["expires_at"]
    if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
      const refreshed = await this.tryRefreshToken(entry.data["refresh_token"])
      if (refreshed) return refreshed
      return null
    }

    return accessToken
  }

  private async tryRefreshToken(
    refreshToken: string | undefined
  ): Promise<string | null> {
    if (!refreshToken) return null

    try {
      const response = await fetch(this.config.tokenExchangeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        await response.text().catch(() => "unknown")
        console.warn(`[google-drive] token refresh failed: HTTP ${response.status}`)
        return null
      }

      const data = await response.json()
      if (data.access_token) {
        await this.saveNewToken(data)
        return data.access_token
      }

      console.warn(
        "[google-drive] token refresh succeeded but no access_token in response"
      )
      return null
    } catch (error) {
      console.warn("[google-drive] token refresh network error:", error)
      return null
    }
  }

  private async saveNewToken(tokenData: {
    access_token: string
    expires_in?: number
    refresh_token?: string
  }): Promise<void> {
    const expiresAt = tokenData.expires_in
      ? String(Date.now() + tokenData.expires_in * 1000)
      : undefined

    const existing = await this.credentialStore.get(this.config.credentialId)
    await this.credentialStore.save(this.config.credentialId, {
      credentialId: this.config.credentialId,
      kind: "google_oauth",
      data: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? existing?.data["refresh_token"] ?? "",
        expires_at: expiresAt ?? "",
        client_id: this.config.clientId ?? "",
      },
    })
  }

  private mapHttpError(status: number, fallbackMessage: string): SyncProviderError {
    if (status === 401 || status === 403) {
      return new SyncProviderErrorClass(
        status === 401 ? "AUTH_INVALID" : "PERMISSION_DENIED",
        "google_drive",
        fallbackMessage,
        false
      )
    }
    if (status === 404) {
      return new SyncProviderErrorClass(
        "NOT_FOUND",
        "google_drive",
        fallbackMessage,
        false
      )
    }
    if (status === 429) {
      return new SyncProviderErrorClass(
        "RATE_LIMITED",
        "google_drive",
        fallbackMessage,
        true
      )
    }
    if (status >= 500) {
      return new SyncProviderErrorClass(
        "REMOTE_ERROR",
        "google_drive",
        fallbackMessage,
        true
      )
    }
    return new SyncProviderErrorClass(
      "REMOTE_ERROR",
      "google_drive",
      fallbackMessage,
      true
    )
  }

  private authError(code: SyncProviderError["code"]): SyncProviderError {
    return new SyncProviderErrorClass(code, "google_drive", `${code}`, false)
  }

  private toProviderError(error: unknown): SyncProviderError {
    if (error instanceof SyncProviderErrorClass) return error
    const msg = String(error)
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("Network request failed") ||
      msg.includes("TypeError")
    ) {
      return new SyncProviderErrorClass("NETWORK", "google_drive", msg, true)
    }
    return new SyncProviderErrorClass("REMOTE_ERROR", "google_drive", msg, true)
  }
}
