import type { SyncSnapshot, RemoteRevision } from "../provider-types"
import type { CredentialStore } from "../provider-types"
import type { GoogleDriveProviderConfig } from "../provider-types"

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("../../archive-utils", () => ({
  zipTextEntriesAsync: jest.fn(),
  unzipTextEntriesAsync: jest.fn(),
}))

import { GoogleDriveProvider } from "../google-drive-provider"
import {
  zipTextEntriesAsync,
  unzipTextEntriesAsync,
} from "../../archive-utils"

const mockZip = zipTextEntriesAsync as jest.Mock
const mockUnzip = unzipTextEntriesAsync as jest.Mock

const mockCredentialStore: CredentialStore = {
  get: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
}

function createConfig(
  overrides: Partial<GoogleDriveProviderConfig> = {}
): GoogleDriveProviderConfig {
  return {
    kind: "google_drive",
    id: "test-drive",
    label: "Test Drive",
    credentialId: "google-creds",
    archiveFileName: "expenses-archive.zip",
    ...overrides,
  }
}

function mockFetch(response: {
  ok?: boolean
  status?: number
  json?: any
  text?: any
}) {
  return jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.json ?? {},
    text: async () => response.text ?? "",
  }) as unknown as jest.Mock
}

describe("GoogleDriveProvider", () => {
  let provider: GoogleDriveProvider

  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockCredentialStore.get as jest.Mock).mockResolvedValue({
      credentialId: "google-creds",
      kind: "google_oauth",
      data: {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_at: String(Date.now() + 3600000),
      },
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    })
    provider = new GoogleDriveProvider(
      createConfig(),
      mockCredentialStore
    )
  })

  describe("testConnection", () => {
    it("returns ok when Drive API responds", async () => {
      global.fetch = mockFetch({
        json: { files: [] },
      })

      const result = await provider.testConnection()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.label).toBe("Google Drive (appDataFolder)")
      }
    })

    it("returns AUTH_MISSING when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      const result = await provider.testConnection()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("AUTH_MISSING")
      }
    })

    it("returns AUTH_INVALID on 401", async () => {
      global.fetch = mockFetch({ ok: false, status: 401 })

      const result = await provider.testConnection()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("AUTH_INVALID")
      }
    })

    it("returns PERMISSION_DENIED on 403", async () => {
      global.fetch = mockFetch({ ok: false, status: 403 })

      const result = await provider.testConnection()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_DENIED")
      }
    })
  })

  describe("readSnapshot", () => {
    it("returns null when no archive file exists", async () => {
      global.fetch = mockFetch({
        json: { files: [] },
      })

      const result = await provider.readSnapshot()
      expect(result).toBeNull()
    })

    it("returns SyncSnapshot when archive exists", async () => {
      const findResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-123",
              name: "expenses-archive.zip",
              version: 5,
              modifiedTime: "2024-06-01T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })

      const downloadResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "base64-encoded-archive-content",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(findResponse)
        .mockResolvedValueOnce(downloadResponse)

      mockUnzip.mockResolvedValue([
        { path: "2024-06-01.csv", content: "id,amount\n1,100" },
        { path: "settings.json", content: '{"theme":"dark"}' },
      ])

      const result = await provider.readSnapshot()
      expect(result).not.toBeNull()
      expect(result!.files["2024-06-01.csv"]).toBe("id,amount\n1,100")
      expect(result!.remoteRevision).toEqual({
        kind: "drive_version",
        fileId: "file-123",
        version: 5,
      })
    })

    it("returns null when unzip returns empty", async () => {
      global.fetch = mockFetch({
        json: {
          files: [
            {
              id: "file-123",
              name: "expenses-archive.zip",
              version: 3,
              modifiedTime: "2024-06-01T00:00:00Z",
            },
          ],
        },
      })
      global.fetch = mockFetch({
        text: "base64-archive",
      })

      mockUnzip.mockResolvedValue([])

      const result = await provider.readSnapshot()
      expect(result).toBeNull()
    })

    it("throws AUTH_MISSING when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      await expect(provider.readSnapshot()).rejects.toThrow(/AUTH_MISSING/)
    })
  })

  describe("writeSnapshot", () => {
    const snapshot: SyncSnapshot = {
      manifest: {
        version: 1,
        generatedAt: "2024-06-01T00:00:00Z",
        appVersion: "1.0.0",
        files: [
          { path: "2024-06-01.csv", hash: "abc123" },
          { path: "2024-06-02.csv", hash: "def456" },
        ],
      },
      files: {
        "2024-06-01.csv": "id,amount\n1,100",
        "2024-06-02.csv": "id,amount\n2,200",
      },
      remoteRevision: null,
    }

    it("creates a new archive when none exists", async () => {
      mockZip.mockResolvedValue("new-base64-archive")

      const findResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ files: [] }),
        text: async () => "",
      })

      const createResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: "new-file" }),
        text: async () => "",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(findResponse)
        .mockResolvedValueOnce(createResponse)

      await provider.writeSnapshot(snapshot, null)

      expect(mockZip).toHaveBeenCalledWith([
        { path: "2024-06-01.csv", content: "id,amount\n1,100" },
        { path: "2024-06-02.csv", content: "id,amount\n2,200" },
      ])
    })

    it("updates existing archive", async () => {
      mockZip.mockResolvedValue("updated-base64-archive")

      const findResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-123",
              name: "expenses-archive.zip",
              version: 5,
              modifiedTime: "2024-06-01T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })

      const updateResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: "file-123" }),
        text: async () => "",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(findResponse)
        .mockResolvedValueOnce(updateResponse)

      const revision: RemoteRevision = {
        kind: "drive_version",
        fileId: "file-123",
        version: 5,
      }

      await provider.writeSnapshot(snapshot, revision)
    })

    it("throws CONFLICT on stale write detection", async () => {
      mockZip.mockResolvedValue("archive-data")

      const findResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-123",
              name: "expenses-archive.zip",
              version: 6,
              modifiedTime: "2024-06-02T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })

      global.fetch = jest.fn().mockResolvedValueOnce(findResponse)

      const revision: RemoteRevision = {
        kind: "drive_version",
        fileId: "file-123",
        version: 5,
      }

      await expect(
        provider.writeSnapshot(snapshot, revision)
      ).rejects.toThrow("Remote archive has been modified since last sync")
    })

    it("throws AUTH_MISSING when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      await expect(
        provider.writeSnapshot(snapshot, null)
      ).rejects.toThrow(/AUTH_MISSING/)
    })
  })

  describe("getStatus", () => {
    it("returns connected when Drive API responds", async () => {
      global.fetch = mockFetch({
        json: { files: [{ id: "f1", modifiedTime: "2024-01-01T00:00:00Z" }] },
      })

      const status = await provider.getStatus()
      expect(status.connected).toBe(true)
    })

    it("returns not connected on error", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Network error"))

      const status = await provider.getStatus()
      expect(status.connected).toBe(false)
    })

    it("returns not connected when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      const status = await provider.getStatus()
      expect(status.connected).toBe(false)
    })
  })
})
