import { registerFactory } from "./provider-registry"
import { GitHubProvider } from "./github-provider"
import { credentialStore } from "./credential-store"
import type { GitHubProviderConfig, ProviderConfig } from "./provider-types"

registerFactory({
  kind: "github",
  create: (config: ProviderConfig) =>
    new GitHubProvider(config as GitHubProviderConfig, credentialStore),
})
