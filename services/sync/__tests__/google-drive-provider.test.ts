import type { SyncSnapshot, RemoteRevision } from "../provider-types"
import type { CredentialStore } from "../provider-types"
import type { GoogleDriveProviderConfig } from "../provider-types"
import { APP_CONFIG } from "../../../constants/app-config"

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

import { GoogleDriveProvider } from "../google-drive-provider"
import type { DriveYearCache } from "../google-drive-provider"

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
      expect(result!.remoteRevision).toMatchObject({
        kind: "drive",
        fileVersions: expect.any(Object),
      })
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

    it("reads settings from the dedicated settings.json file, not a year body", async () => {
      const listResponse = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2025",
              name: "expense-buddy-2025.json",
              version: 1,
              modifiedTime: "2025-01-01T00:00:00Z",
            },
            {
              id: "file-settings",
              name: "settings.json",
              version: 3,
              modifiedTime: "2025-01-02T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })

      const downloadYear = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () =>
          JSON.stringify({ v: 1, f: { "expenses/2025-01-15.csv": "id,amount\n2,200" } }),
      })

      const downloadSettings = Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '{"theme":"dark"}',
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(downloadYear)
        .mockResolvedValueOnce(downloadSettings)

      const result = await provider.readSnapshot()

      expect(result).not.toBeNull()
      expect(result!.files["settings.json"]).toBe('{"theme":"dark"}')
      expect(result!.files["expenses/2025-01-15.csv"]).toBe("id,amount\n2,200")
      // settings.json is not a year file, so it carries no per-year revision.
      expect(result!.remoteRevision).toMatchObject({
        kind: "drive",
        fileVersions: { "2025": expect.any(Object) },
      })
    })
  })

  describe("readSnapshot version preflight", () => {
    function makeListResponse(
      files: Array<{ id: string; name: string; version: number }>
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: files.map((f) => ({
            ...f,
            modifiedTime: "2025-01-01T00:00:00Z",
          })),
        }),
        text: async () => "",
      })
    }

    function makeCache(
      overrides: Partial<DriveYearCache> = {}
    ): jest.Mocked<DriveYearCache> {
      return {
        loadIndex: jest.fn().mockResolvedValue({}),
        readYear: jest.fn().mockResolvedValue(null),
        saveYear: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      } as jest.Mocked<DriveYearCache>
    }

    it("skips download when version matches and usable cached content exists", async () => {
      const cache = makeCache({
        loadIndex: jest.fn().mockResolvedValue({
          "2024": { fileId: "file-2024", version: 7, contentHash: "h2024" },
        }),
        readYear: jest
          .fn()
          .mockResolvedValue({ "expenses/2024-06-01.csv": "id,amount\n1,100" }),
      })
      const cachedProvider = new GoogleDriveProvider(
        createConfig(),
        mockCredentialStore,
        cache
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          makeListResponse([
            { id: "file-2024", name: "expense-buddy-2024.json", version: 7 },
          ])
        )

      const result = await cachedProvider.readSnapshot()

      expect(result).not.toBeNull()
      expect(result!.files["expenses/2024-06-01.csv"]).toBe("id,amount\n1,100")
      // Only the list call happened — no download.
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1)
      expect(cache.readYear).toHaveBeenCalledWith("2024")
      expect(result!.remoteRevision).toMatchObject({
        kind: "drive",
        fileVersions: { "2024": { fileId: "file-2024", version: 7 } },
      })
    })

    it("downloads when cache is missing even if version matches", async () => {
      const cache = makeCache({
        loadIndex: jest.fn().mockResolvedValue({
          "2024": { fileId: "file-2024", version: 7, contentHash: "h2024" },
        }),
        readYear: jest.fn().mockResolvedValue(null),
      })
      const cachedProvider = new GoogleDriveProvider(
        createConfig(),
        mockCredentialStore,
        cache
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          makeListResponse([
            { id: "file-2024", name: "expense-buddy-2024.json", version: 7 },
          ])
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () =>
              JSON.stringify({
                v: 1,
                f: { "expenses/2024-06-01.csv": "id,amount\n9,900" },
              }),
          })
        )

      const result = await cachedProvider.readSnapshot()

      expect(result).not.toBeNull()
      expect(result!.files["expenses/2024-06-01.csv"]).toBe("id,amount\n9,900")
      // List + download both happened.
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(2)
      expect(cache.saveYear).toHaveBeenCalledWith(
        "2024",
        { "expenses/2024-06-01.csv": "id,amount\n9,900" },
        expect.objectContaining({ fileId: "file-2024", version: 7 })
      )
    })

    it("downloads when the Drive version advanced past the cached revision", async () => {
      const cache = makeCache({
        loadIndex: jest.fn().mockResolvedValue({
          "2024": { fileId: "file-2024", version: 7, contentHash: "h2024" },
        }),
        readYear: jest.fn().mockResolvedValue({ "expenses/2024-06-01.csv": "stale" }),
      })
      const cachedProvider = new GoogleDriveProvider(
        createConfig(),
        mockCredentialStore,
        cache
      )

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          makeListResponse([
            { id: "file-2024", name: "expense-buddy-2024.json", version: 8 },
          ])
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () =>
              JSON.stringify({
                v: 1,
                f: { "expenses/2024-06-01.csv": "fresh" },
              }),
          })
        )

      const result = await cachedProvider.readSnapshot()

      expect(result).not.toBeNull()
      expect(result!.files["expenses/2024-06-01.csv"]).toBe("fresh")
      // Version mismatch => download despite a cached body being present.
      expect(cache.readYear).not.toHaveBeenCalled()
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(2)
      expect(result!.remoteRevision).toMatchObject({
        kind: "drive",
        fileVersions: { "2024": { version: 8 } },
      })
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

      const revision: RemoteRevision = { kind: "drive", fileVersions: {} }

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

    it("evicts the per-year cache when a year file is deleted", async () => {
      const cache = {
        loadIndex: jest.fn().mockResolvedValue({}),
        readYear: jest.fn().mockResolvedValue(null),
        saveYear: jest.fn().mockResolvedValue(undefined),
        removeYear: jest.fn().mockResolvedValue(undefined),
      }
      const cachedProvider = new GoogleDriveProvider(
        createConfig(),
        mockCredentialStore,
        cache
      )

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

      await cachedProvider.writeSnapshot(deleteSnapshot, null)

      expect(cache.removeYear).toHaveBeenCalledWith("2024")
    })
  })

  describe("writeSnapshot version preflight", () => {
    const conflictSnapshot: SyncSnapshot = {
      manifest: {
        version: 1,
        generatedAt: "2024-06-01T00:00:00Z",
        appVersion: APP_CONFIG.version,
        files: [],
      },
      files: { "expenses/2024-06-01.csv": "id,amount\n1,100" },
      remoteRevision: null,
    }

    function find2024(version: number) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          files: [
            {
              id: "file-2024",
              name: "expense-buddy-2024.json",
              version,
              modifiedTime: "2024-06-01T00:00:00Z",
            },
          ],
        }),
        text: async () => "",
      })
    }

    it("throws CONFLICT and leaves the year file unchanged when the Drive version advanced", async () => {
      const lastKnown: RemoteRevision = {
        kind: "drive",
        fileVersions: {
          "2024": { fileId: "file-2024", version: 1, contentHash: "h2024" },
        },
      }

      // call 0: findFileByName -> file exists at version 1 (stale list value)
      // call 1: getFileVersion -> current Drive version is 2 (drift)
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(find2024(1))
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 2 }),
            text: async () => "",
          })
        )

      await expect(
        provider.writeSnapshot(conflictSnapshot, lastKnown)
      ).rejects.toMatchObject({ code: "CONFLICT" })

      const calls = (global.fetch as jest.Mock).mock.calls
      // Only the find + version preflight happened; no download/update/delete.
      expect(calls.length).toBe(2)
      expect(calls.some((c: any[]) => String(c[0]).includes("upload/drive"))).toBe(false)
      expect(calls.some((c: any[]) => String(c[1]?.method) === "DELETE")).toBe(false)
    })

    it("writes the year file when the Drive version matches lastKnownRevision", async () => {
      const lastKnown: RemoteRevision = {
        kind: "drive",
        fileVersions: {
          "2024": { fileId: "file-2024", version: 5, contentHash: "h2024" },
        },
      }

      // call 0: find -> file exists
      // call 1: getFileVersion -> current version 5 (matches => no conflict)
      // call 2: download existing body
      // call 3: update
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(find2024(5))
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 5 }),
            text: async () => "",
          })
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () =>
              JSON.stringify({
                v: 1,
                f: { "expenses/2024-05-01.csv": "id,amount\n3,300" },
              }),
          })
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ version: 6 }),
            text: async () => "",
          })
        )

      await expect(
        provider.writeSnapshot(conflictSnapshot, lastKnown)
      ).resolves.toBeUndefined()

      const calls = (global.fetch as jest.Mock).mock.calls
      const updateCall = calls.find((c: any[]) =>
        String(c[0]).includes("upload/drive/v3/files/file-2024")
      )
      expect(updateCall).toBeDefined()
      expect(updateCall![1]?.method).toBe("PATCH")
    })

    it("does not fail the sync when deleting an empty year file fails", async () => {
      const deleteSnapshot: SyncSnapshot = {
        manifest: {
          version: 1,
          generatedAt: "2024-06-01T00:00:00Z",
          appVersion: APP_CONFIG.version,
          files: [],
        },
        // Deleting the only day empties the year body.
        files: { "expenses/2024-06-01.csv": "" },
        remoteRevision: null,
      }

      // call 0: find -> file exists
      // call 1: download -> body with a single day
      // call 2: delete -> fails (500); must be swallowed, sync still succeeds
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(find2024(1))
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () =>
              JSON.stringify({
                v: 1,
                f: { "expenses/2024-06-01.csv": "id,amount\n1,100" },
              }),
          })
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({}),
            text: async () => "server error",
          })
        )

      await expect(provider.writeSnapshot(deleteSnapshot, null)).resolves.toBeUndefined()

      const deleteCall = (global.fetch as jest.Mock).mock.calls[2]
      expect(deleteCall[0]).toContain("drive/v3/files/file-2024")
      expect(deleteCall[1]?.method).toBe("DELETE")
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
