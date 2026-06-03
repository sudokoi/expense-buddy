import {
  saveSyncConfig,
  loadSyncConfig,
  clearSyncConfig,
  getActiveProviderConfig,
  migrateSyncConfig,
} from "../sync-config"
import { secureStorage } from "../secure-storage"
import { credentialStore } from "../sync/credential-store"
import { providerSettingsStore } from "../sync/provider-settings-store"

jest.mock("../secure-storage", () => ({
  secureStorage: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}))

jest.mock("../sync/credential-store", () => ({
  credentialStore: {
    save: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock("../sync/provider-settings-store", () => ({
  providerSettingsStore: {
    load: jest.fn(() => ({ activeProviderId: null, providers: [] })),
    addProvider: jest.fn(),
    setActiveProvider: jest.fn(),
    removeProvider: jest.fn(),
    getActiveConfig: jest.fn(() => null),
  },
}))

jest.mock("../sync/credential-store", () => ({
  credentialStore: {
    save: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock("../sync/provider-settings-store", () => ({
  providerSettingsStore: {
    load: jest.fn(() => ({ activeProviderId: null, providers: [] })),
    addProvider: jest.fn(),
    setActiveProvider: jest.fn(),
    removeProvider: jest.fn(),
    getActiveConfig: jest.fn(() => null),
  },
}))

jest.mock("../github-sync", () => ({
  validatePAT: jest.fn(),
  GitHubApiError: class GitHubApiError extends Error {
    status: number
    shouldSignOut: boolean
    constructor(message: string, status: number, shouldSignOut: boolean) {
      super(message)
      this.status = status
      this.shouldSignOut = shouldSignOut
    }
  },
}))

jest.mock("i18next", () => ({
  t: (key: string) => key,
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(secureStorage.getItem as jest.Mock).mockReset()
  ;(credentialStore.get as jest.Mock).mockReset()
})

describe("saveSyncConfig", () => {
  it("writes to old SecureStorage keys and new provider store", async () => {
    await saveSyncConfig({
      token: "ghp_abc123",
      repo: "user/repo",
      branch: "main",
    })

    expect(secureStorage.setItem).toHaveBeenCalledWith("github_pat", "ghp_abc123")
    expect(secureStorage.setItem).toHaveBeenCalledWith("github_repo", "user/repo")
    expect(secureStorage.setItem).toHaveBeenCalledWith("github_branch", "main")

    expect(credentialStore.save).toHaveBeenCalledWith("github_pat", {
      credentialId: "github_pat",
      kind: "github_pat",
      data: { token: "ghp_abc123" },
    })

    expect(providerSettingsStore.addProvider).toHaveBeenCalledWith({
      kind: "github",
      id: "default",
      label: "user/repo",
      credentialId: "github_pat",
      repo: "user/repo",
      branch: "main",
    })

    expect(providerSettingsStore.setActiveProvider).toHaveBeenCalledWith("default")
  })
})

describe("loadSyncConfig", () => {
  it("returns config from old SecureStorage keys when present", async () => {
    ;(secureStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "github_pat") return Promise.resolve("ghp_token")
      if (key === "github_repo") return Promise.resolve("user/repo")
      if (key === "github_branch") return Promise.resolve("main")
      return Promise.resolve(null)
    })

    const result = await loadSyncConfig()
    expect(result).toEqual({ token: "ghp_token", repo: "user/repo", branch: "main" })
  })

  it("falls back to provider store when old keys are missing", async () => {
    ;(secureStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(providerSettingsStore.getActiveConfig as jest.Mock).mockResolvedValue({
      kind: "github",
      id: "default",
      label: "user/repo",
      credentialId: "github_pat",
      repo: "fallback/repo",
      branch: "dev",
    })
    ;(credentialStore.get as jest.Mock).mockResolvedValue({
      credentialId: "github_pat",
      kind: "github_pat",
      data: { token: "ghp_fallback" },
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    })

    const result = await loadSyncConfig()
    expect(result).toEqual({
      token: "ghp_fallback",
      repo: "fallback/repo",
      branch: "dev",
    })
  })

  it("returns null when neither old keys nor provider store has GitHub config", async () => {
    ;(secureStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(providerSettingsStore.getActiveConfig as jest.Mock).mockResolvedValue(null)

    const result = await loadSyncConfig()
    expect(result).toBeNull()
  })

  it("returns null when provider is not GitHub kind", async () => {
    ;(secureStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(providerSettingsStore.getActiveConfig as jest.Mock).mockResolvedValue({
      kind: "google_drive",
      id: "drive-1",
      label: "Google Drive",
      credentialId: "drive-creds",
      clientId: "test.apps.googleusercontent.com",
      archiveFileName: "backup.zip",
    })

    const result = await loadSyncConfig()
    expect(result).toBeNull()
  })
})

describe("clearSyncConfig", () => {
  it("clears old keys and new provider store", async () => {
    await clearSyncConfig()

    expect(secureStorage.deleteItem).toHaveBeenCalledWith("github_pat")
    expect(secureStorage.deleteItem).toHaveBeenCalledWith("github_repo")
    expect(secureStorage.deleteItem).toHaveBeenCalledWith("github_branch")
    expect(credentialStore.delete).toHaveBeenCalledWith("github_pat")
    expect(providerSettingsStore.removeProvider).toHaveBeenCalledWith("default")
  })
})

describe("getActiveProviderConfig", () => {
  it("delegates to providerSettingsStore", async () => {
    const mockConfig = {
      kind: "github" as const,
      id: "default",
      label: "user/repo",
      credentialId: "github_pat",
      repo: "user/repo",
      branch: "main",
    }
    ;(providerSettingsStore.getActiveConfig as jest.Mock).mockResolvedValue(mockConfig)

    const result = await getActiveProviderConfig()
    expect(result).toEqual(mockConfig)
  })
})

describe("migrateSyncConfig", () => {
  it("skips if already migrated", async () => {
    ;(secureStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "sync.migration.v1") return Promise.resolve("true")
      return Promise.resolve(null)
    })

    await migrateSyncConfig()
    expect(providerSettingsStore.addProvider).not.toHaveBeenCalled()
  })

  it("skips if providers already exist in store", async () => {
    ;(secureStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(providerSettingsStore.load as jest.Mock).mockResolvedValue({
      activeProviderId: "default",
      providers: [
        {
          kind: "github",
          id: "default",
          label: "user/repo",
          credentialId: "github_pat",
          repo: "user/repo",
          branch: "main",
        },
      ],
    })

    await migrateSyncConfig()
    expect(providerSettingsStore.addProvider).not.toHaveBeenCalled()
  })

  it("skips if no old config exists", async () => {
    ;(secureStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(providerSettingsStore.load as jest.Mock).mockResolvedValue({
      activeProviderId: null,
      providers: [],
    })

    await migrateSyncConfig()
    expect(providerSettingsStore.addProvider).not.toHaveBeenCalled()
  })

  it("migrates old config to provider store", async () => {
    ;(secureStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "sync.migration.v1") return Promise.resolve(null)
      if (key === "github_pat") return Promise.resolve("ghp_legacy")
      if (key === "github_repo") return Promise.resolve("legacy/repo")
      if (key === "github_branch") return Promise.resolve("main")
      return Promise.resolve(null)
    })
    ;(providerSettingsStore.load as jest.Mock).mockResolvedValue({
      activeProviderId: null,
      providers: [],
    })

    await migrateSyncConfig()

    expect(credentialStore.save).toHaveBeenCalledWith("github_pat", {
      credentialId: "github_pat",
      kind: "github_pat",
      data: { token: "ghp_legacy" },
    })
    expect(providerSettingsStore.addProvider).toHaveBeenCalledWith({
      kind: "github",
      id: "default",
      label: "legacy/repo",
      credentialId: "github_pat",
      repo: "legacy/repo",
      branch: "main",
    })
    expect(providerSettingsStore.setActiveProvider).toHaveBeenCalledWith("default")
    expect(secureStorage.setItem).toHaveBeenCalledWith("sync.migration.v1", "true")
  })

  it("is idempotent — migration marker prevents re-migration", async () => {
    ;(secureStorage.getItem as jest.Mock).mockResolvedValue("true")

    await migrateSyncConfig()
    await migrateSyncConfig()
    await migrateSyncConfig()

    expect(providerSettingsStore.addProvider).not.toHaveBeenCalled()
  })

  it("handles partial old config gracefully", async () => {
    ;(secureStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "sync.migration.v1") return Promise.resolve(null)
      if (key === "github_pat") return Promise.resolve("ghp_token")
      if (key === "github_repo") return Promise.resolve(null)
      if (key === "github_branch") return Promise.resolve("main")
      return Promise.resolve(null)
    })
    ;(providerSettingsStore.load as jest.Mock).mockResolvedValue({
      activeProviderId: null,
      providers: [],
    })

    await migrateSyncConfig()
    expect(providerSettingsStore.addProvider).not.toHaveBeenCalled()
  })
})
