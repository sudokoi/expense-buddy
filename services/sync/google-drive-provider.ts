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
import { zipTextEntriesAsync, unzipTextEntriesAsync } from "../archive-utils"
import { Platform } from "react-native"

const ARCHIVE_FILENAME = "expenses-archive.zip"
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3"

interface DriveFileMetadata {
  id: string
  name: string
  version: number
  modifiedTime: string
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
      return {
        ok: false,
        error: this.authError("AUTH_MISSING"),
      }
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

      return {
        ok: true,
        label: "Google Drive (appDataFolder)",
      }
    } catch (error) {
      return {
        ok: false,
        error: this.toProviderError(error),
      }
    }
  }

  async readSnapshot(): Promise<SyncSnapshot | null> {
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

    const archiveFile = await this.findArchiveFile(token)
    if (!archiveFile) return null

    const archiveContent = await this.downloadFile(token, archiveFile.id)
    if (!archiveContent) return null

    const entries = await unzipTextEntriesAsync(archiveContent)
    if (!entries || entries.length === 0) return null

    const files: Record<string, string> = {}
    for (const entry of entries) {
      files[entry.path] = entry.content
    }

    const fileList = Object.entries(files).map(([path, content]) => ({
      path,
      hash: simpleHash(content),
    }))

    return {
      manifest: {
        version: 1,
        generatedAt: new Date().toISOString(),
        appVersion: "1.0.0",
        files: fileList,
      },
      files,
      remoteRevision: {
        kind: "drive_version",
        fileId: archiveFile.id,
        version: archiveFile.version,
      },
    }
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

    const entries = Object.entries(snapshot.files).map(([path, content]) => ({
      path,
      content,
    }))
    const archiveBase64 = await zipTextEntriesAsync(entries)

    const archiveFile = await this.findArchiveFile(token)

    if (archiveFile) {
      await this.checkStaleWrite(archiveFile, lastKnownRevision)
      await this.updateFile(token, archiveFile.id, archiveBase64)
    } else {
      await this.createFile(token, archiveBase64)
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
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.config.clientId ?? "",
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      })

      if (!response.ok) return null

      const data = await response.json()
      if (data.access_token) {
        await this.saveNewToken(data)
        return data.access_token
      }
      return null
    } catch {
      return null
    }
  }

  private async saveNewToken(tokenData: {
    access_token: string
    expires_in?: number
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
        refresh_token: existing?.data["refresh_token"] ?? "",
        expires_at: expiresAt ?? "",
        client_id: this.config.clientId ?? "",
      },
    })
  }

  private async findArchiveFile(token: string): Promise<DriveFileMetadata | null> {
    try {
      const response = await fetch(
        `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=name='${ARCHIVE_FILENAME}'&fields=files(id,name,version,modifiedTime)`,
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  private async checkStaleWrite(
    remoteFile: DriveFileMetadata,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void> {
    if (!lastKnownRevision || lastKnownRevision.kind !== "drive_version") {
      return
    }

    if (remoteFile.version > lastKnownRevision.version) {
      throw new SyncProviderErrorClass(
        "CONFLICT",
        "google_drive",
        "Remote archive has been modified since last sync",
        false
      )
    }
  }

  private async createFile(token: string, archiveBase64: string): Promise<void> {
    const boundary = `boundary_${Date.now()}`
    const metadata = JSON.stringify({
      name: ARCHIVE_FILENAME,
      parents: ["appDataFolder"],
      mimeType: "application/zip",
    })

    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      "Content-Type: application/zip",
      "",
      archiveBase64,
      `--${boundary}--`,
    ].join("\r\n")

    const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    })

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to create archive")
    }
  }

  private async updateFile(
    token: string,
    fileId: string,
    archiveBase64: string
  ): Promise<void> {
    const response = await fetch(`${UPLOAD_API_BASE}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/zip",
      },
      body: archiveBase64,
    })

    if (!response.ok) {
      throw this.mapHttpError(response.status, "Failed to update archive")
    }
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

function simpleHash(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16)
}
