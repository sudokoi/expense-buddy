import { registerFactory } from "./provider-registry"
import { GitHubProvider } from "./github-provider"
import { GoogleDriveProvider } from "./google-drive-provider"
import { credentialStore } from "./credential-store"
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
      credentialStore
    ),
})
