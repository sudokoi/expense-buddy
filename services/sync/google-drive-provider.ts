import type { GoogleDriveProviderConfig } from "./provider-types"
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
import { simpleHash } from "./sync-utils"
import { APP_CONFIG } from "../../constants/app-config"
import { Platform } from "react-native"

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

export class GoogleDriveProvider implements SyncProvider {
  readonly kind = "google_drive" as const
  readonly providerId: string

  private config: GoogleDriveProviderConfig
  private credentialStore: CredentialStore

  constructor(config: GoogleDriveProviderConfig, credentialStore: CredentialStore) {
    this.providerId = config.id
    this.config = config
    this.credentialStore = credentialStore
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

  async readSnapshot(filterPaths?: string[]): Promise<SyncSnapshot | null> {
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
    if (yearFiles.length === 0) return null

    const files: Record<string, string> = {}
    const filterSet = filterPaths ? new Set(filterPaths) : null
    const neededYears: Set<string> | null = filterSet
      ? new Set(
          Array.from(filterSet).map((p) =>
            String(this.getYearForPath(p, new Date().getFullYear()))
          )
        )
      : null

    const fileVersions: Record<string, string> = {}

    for (const file of yearFiles) {
      const fileYear = file.name.slice(YEAR_FILE_PREFIX.length, -YEAR_FILE_SUFFIX.length)
      if (neededYears && !neededYears.has(fileYear)) continue

      const content = await this.downloadFile(token, file.id)
      if (!content) continue

      fileVersions[fileYear] = simpleHash(content)

      const parsed = this.parseYearFile(content)
      for (const [path, fileContent] of Object.entries(parsed.f)) {
        if (filterSet && !filterSet.has(path)) continue
        files[path] = fileContent
      }
    }

    if (Object.keys(files).length === 0) return null

    const fileList = Object.entries(files).map(([path, content]) => ({
      path,
      hash: simpleHash(content),
    }))

    return {
      manifest: {
        version: 1,
        generatedAt: new Date().toISOString(),
        appVersion: APP_CONFIG.version,
        files: fileList,
      },
      files,
      remoteRevision: { kind: "drive", fileVersions },
    }
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

    for (const [yearStr, changedFiles] of Object.entries(filesByYear)) {
      const fileName = this.yearFileName(parseInt(yearStr, 10))
      const existingFile = await this.findFileByName(token, fileName)

      const existingContent = existingFile
        ? await this.downloadFile(token, existingFile.id)
        : null

      if (
        existingContent &&
        lastKnownRevision?.kind === "drive" &&
        lastKnownRevision.fileVersions
      ) {
        const knownVersion = lastKnownRevision.fileVersions[yearStr]
        if (knownVersion && simpleHash(existingContent) !== knownVersion) {
          throw new SyncProviderErrorClass(
            "CONFLICT",
            "google_drive",
            `Year file ${yearStr} was modified by another device since last read`,
            false
          )
        }
      }

      const yearData: YearFileData = existingContent
        ? this.parseYearFile(existingContent)
        : { v: 1, f: {} }

      for (const [path, content] of Object.entries(changedFiles)) {
        if (content.length === 0) {
          delete yearData.f[path]
        } else {
          yearData.f[path] = content
        }
      }

      const hasEntries = Object.keys(yearData.f).length > 0

      if (existingFile) {
        if (hasEntries) {
          await this.updateFile(token, existingFile.id, JSON.stringify(yearData))
        } else {
          await this.deleteFile(token, existingFile.id)
        }
      } else if (hasEntries) {
        await this.createFile(token, fileName, JSON.stringify(yearData))
      }
    }
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

  private async createFile(token: string, fileName: string, body: string): Promise<void> {
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

    const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to create file")
    }
  }

  private async updateFile(token: string, fileId: string, body: string): Promise<void> {
    const response = await fetch(`${UPLOAD_API_BASE}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    })

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to update file")
    }
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
