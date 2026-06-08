import { registerFactory } from "./provider-registry"
import { GitHubProvider } from "./github-provider"
import { GoogleDriveProvider } from "./google-drive-provider"
import { credentialStore } from "./credential-store"
import { createDriveYearCache } from "./drive-year-cache"
import type {
  GitHubProviderConfig,
  GoogleDriveProviderConfig,
  ProviderConfig,
} from "./provider-types"

registerFactory({
  kind: "github",
  create: (config: ProviderConfig) =>
    new GitHubProvider(config as GitHubProviderConfig, credentialStore),
})

registerFactory({
  kind: "google_drive",
  create: (config: ProviderConfig) =>
    new GoogleDriveProvider(
      config as GoogleDriveProviderConfig,
      credentialStore,
      // Provider-scoped per-year revision/content cache backing the
      // `sync.providers.<id>.remoteIndex` metadata (Requirements 7.3, 11.1).
      createDriveYearCache(config.id)
    ),
})
