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
  clientId: "test-client-id.apps.googleusercontent.com",
  tokenExchangeUrl: "https://token-exchange.test/",
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

  it("creates a google_drive provider when factory is registered", () => {
    registerFactory({
      kind: "google_drive",
      create: () => ({
        kind: "google_drive" as const,
        providerId: "test-drive",
        testConnection: jest.fn(),
        readSnapshot: jest.fn(),
        writeSnapshot: jest.fn(),
        getStatus: jest.fn(),
      }),
    })

    const provider = createProvider(mockDriveConfig)
    expect(provider.kind).toBe("google_drive")
    expect(provider.providerId).toBe("test-drive")
  })

  it("reports registered kinds including google_drive", () => {
    registerFactory({
      kind: "github",
      create: () => mockGitHubProvider,
    })
    registerFactory({
      kind: "google_drive",
      create: () => ({
        kind: "google_drive" as const,
        providerId: "test-drive",
        testConnection: jest.fn(),
        readSnapshot: jest.fn(),
        writeSnapshot: jest.fn(),
        getStatus: jest.fn(),
      }),
    })
    const kinds = getRegisteredKinds()
    expect(kinds).toContain("github")
    expect(kinds).toContain("google_drive")
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
