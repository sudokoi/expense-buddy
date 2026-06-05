import type { SyncSnapshot, RemoteRevision } from "../provider-types"
import type { CredentialStore } from "../provider-types"
import type { GoogleDriveProviderConfig } from "../provider-types"
import { APP_CONFIG } from "../../../constants/app-config"

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

import { GoogleDriveProvider } from "../google-drive-provider"

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
    clientId: "test-client-id.apps.googleusercontent.com",
    tokenExchangeUrl: "https://token-exchange.test/",
    ...overrides,
  }
}

function mockFetch(response: { ok?: boolean; status?: number; json?: any; text?: any }) {
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
    provider = new GoogleDriveProvider(createConfig(), mockCredentialStore)
  })

  describe("testConnection", () => {
    it("returns ok when Drive API responds", async () => {
      global.fetch = mockFetch({ json: { files: [] } })

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
    it("returns null when no year files exist", async () => {
      global.fetch = mockFetch({ json: { files: [] } })

      const result = await provider.readSnapshot()
      expect(result).toBeNull()
    })

    it("returns SyncSnapshot from year files", async () => {
      const listResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2024",
              name: "expense-buddy-2024.json",
              version: 1,
              modifiedTime: "2024-06-01T00:00:00Z",
            },
            {
              id: "file-2025",
              name: "expense-buddy-2025.json",
              version: 2,
              modifiedTime: "2025-01-01T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })

      const download2024 = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () =>
          JSON.stringify({ v: 1, f: { "expenses/2024-06-01.csv": "id,amount\n1,100" } }),
      })

      const download2025 = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () =>
          JSON.stringify({ v: 1, f: { "expenses/2025-01-15.csv": "id,amount\n2,200" } }),
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(download2024)
        .mockResolvedValueOnce(download2025)

      const result = await provider.readSnapshot()
      expect(result).not.toBeNull()
      expect(result!.files["expenses/2024-06-01.csv"]).toBe("id,amount\n1,100")
      expect(result!.files["expenses/2025-01-15.csv"]).toBe("id,amount\n2,200")
      expect(result!.remoteRevision).toEqual({ kind: "drive" })
    })

    it("returns null when all year files are empty", async () => {
      const listResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2024",
              name: "expense-buddy-2024.json",
              version: 1,
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
        text: async () => JSON.stringify({ v: 1, f: {} }),
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(downloadResponse)

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
        appVersion: APP_CONFIG.version,
        files: [
          { path: "expenses/2024-06-01.csv", hash: "abc123" },
          { path: "expenses/2024-06-02.csv", hash: "def456" },
          { path: "settings.json", hash: "xyz789" },
        ],
      },
      files: {
        "expenses/2024-06-01.csv": "id,amount\n1,100",
        "expenses/2024-06-02.csv": "id,amount\n2,200",
        "settings.json": '{"theme":"dark"}',
      },
      remoteRevision: null,
    }

    it("creates new year files when none exist", async () => {
      const list2024Response = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ files: [] }),
        text: async () => "",
      })

      const listSettingsResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ files: [] }),
        text: async () => "",
      })

      const create2024Response = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: "new-2024" }),
        text: async () => "",
      })

      const createSettingsResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: "new-settings" }),
        text: async () => "",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(list2024Response)
        .mockResolvedValueOnce(create2024Response)
        .mockResolvedValueOnce(listSettingsResponse)
        .mockResolvedValueOnce(createSettingsResponse)

      await provider.writeSnapshot(snapshot, null)

      const calls = (global.fetch as jest.Mock).mock.calls
      const createCalls = calls.filter((c: any[]) =>
        String(c[0]).includes("upload/drive")
      )
      expect(createCalls.length).toBe(2)

      const year2024Body = createCalls[0][1]?.body ?? ""
      expect(year2024Body).toContain("expenses/2024-06-01.csv")
      expect(year2024Body).toContain("id,amount\\n1,100")
    })

    it("updates existing year file", async () => {
      const find2024Response = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2024",
              name: "expense-buddy-2024.json",
              version: 1,
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
        text: async () =>
          JSON.stringify({ v: 1, f: { "expenses/2024-05-01.csv": "id,amount\n3,300" } }),
      })

      const updateResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(find2024Response)
        .mockResolvedValueOnce(downloadResponse)
        .mockResolvedValueOnce(updateResponse)

      const revision: RemoteRevision = { kind: "drive" }

      const smallSnapshot: SyncSnapshot = {
        manifest: {
          version: 1,
          generatedAt: "2024-06-01T00:00:00Z",
          appVersion: APP_CONFIG.version,
          files: [],
        },
        files: { "expenses/2024-06-01.csv": "id,amount\n1,100" },
        remoteRevision: revision,
      }

      await provider.writeSnapshot(smallSnapshot, revision)

      const updateCall = (global.fetch as jest.Mock).mock.calls[2]
      expect(updateCall[0]).toContain("upload/drive/v3/files/file-2024")
      expect(updateCall[1]?.method ?? "PATCH").toContain("PATCH")
    })

    it("removes entries with empty content and deletes file when empty", async () => {
      const find2024Response = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2024",
              name: "expense-buddy-2024.json",
              version: 1,
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
        text: async () =>
          JSON.stringify({ v: 1, f: { "expenses/2024-06-01.csv": "id,amount\n1,100" } }),
      })

      const deleteResponse = Promise.resolve({
        ok: true,
        status: 204,
        json: async () => ({}),
        text: async () => "",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(find2024Response)
        .mockResolvedValueOnce(downloadResponse)
        .mockResolvedValueOnce(deleteResponse)

      const deleteSnapshot: SyncSnapshot = {
        manifest: {
          version: 1,
          generatedAt: "2024-06-01T00:00:00Z",
          appVersion: APP_CONFIG.version,
          files: [],
        },
        files: { "expenses/2024-06-01.csv": "" },
        remoteRevision: null,
      }

      await provider.writeSnapshot(deleteSnapshot, null)

      const deleteCall = (global.fetch as jest.Mock).mock.calls[2]
      expect(deleteCall[0]).toContain("drive/v3/files/file-2024")
      expect(deleteCall[1]?.method ?? "DELETE").toContain("DELETE")
    })

    it("throws AUTH_MISSING when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      await expect(provider.writeSnapshot(snapshot, null)).rejects.toThrow(/AUTH_MISSING/)
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
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"))

      const status = await provider.getStatus()
      expect(status.connected).toBe(false)
    })

    it("returns not connected when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      const status = await provider.getStatus()
      expect(status.connected).toBe(false)
    })
  })

  describe("deleteRemoteData", () => {
    it("returns false when no year files exist", async () => {
      global.fetch = mockFetch({ json: { files: [] } })

      await expect(provider.deleteRemoteData()).resolves.toBe(false)
    })

    it("deletes all year files", async () => {
      const listResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2024",
              name: "expense-buddy-2024.json",
              version: 1,
              modifiedTime: "2024-06-01T00:00:00Z",
            },
            {
              id: "file-2025",
              name: "expense-buddy-2025.json",
              version: 2,
              modifiedTime: "2025-01-01T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })

      const delete2024Response = Promise.resolve({
        ok: true,
        status: 204,
        json: async () => ({}),
        text: async () => "",
      })

      const delete2025Response = Promise.resolve({
        ok: true,
        status: 204,
        json: async () => ({}),
        text: async () => "",
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(delete2024Response)
        .mockResolvedValueOnce(delete2025Response)

      await expect(provider.deleteRemoteData()).resolves.toBe(true)
      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "https://www.googleapis.com/drive/v3/files/file-2024",
        expect.objectContaining({ method: "DELETE" })
      )
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        "https://www.googleapis.com/drive/v3/files/file-2025",
        expect.objectContaining({ method: "DELETE" })
      )
    })

    it("throws AUTH_MISSING when no token", async () => {
      ;(mockCredentialStore.get as jest.Mock).mockResolvedValue(null)

      await expect(provider.deleteRemoteData()).rejects.toThrow(/AUTH_MISSING/)
    })
  })
})
