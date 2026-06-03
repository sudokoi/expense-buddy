import type { SyncProvider, ProviderConfig } from "../provider-types"
import { registerFactory, createProvider, getRegisteredKinds } from "../provider-registry"

afterEach(() => {
  jest.resetModules()
})

const mockConfig: ProviderConfig = {
  id: "test-github",
  kind: "github",
  label: "Test GitHub",
  credentialId: "cred-1",
  repo: "user/test",
  branch: "main",
}

const mockGitHubProvider: SyncProvider = {
  kind: "github",
  providerId: "test-github",
  testConnection: jest.fn(),
  readSnapshot: jest.fn(),
  writeSnapshot: jest.fn(),
  getStatus: jest.fn(),
}

const mockDriveConfig: ProviderConfig = {
  id: "test-drive",
  kind: "google_drive",
  label: "Test Drive",
  credentialId: "cred-2",
  archiveFileName: "backup.zip",
}

describe("provider-registry", () => {
  it("creates a provider via registered factory", () => {
    registerFactory({
      kind: "github",
      create: () => mockGitHubProvider,
    })

    const provider = createProvider(mockConfig)
    expect(provider.kind).toBe("github")
    expect(provider.providerId).toBe("test-github")
  })

  it("throws when no factory is registered for a kind", () => {
    expect(() => createProvider(mockDriveConfig)).toThrow(
      "No sync provider factory registered for kind: google_drive"
    )
  })

  it("reports registered kinds", () => {
    registerFactory({
      kind: "github",
      create: () => mockGitHubProvider,
    })
    const kinds = getRegisteredKinds()
    expect(kinds).toContain("github")
  })
})
