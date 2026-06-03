import type { SyncProvider, SyncProviderFactory, ProviderConfig } from "./provider-types"
import { SyncProviderError } from "./provider-types"

const factories = new Map<string, SyncProviderFactory>()

export function registerFactory(factory: SyncProviderFactory): void {
  factories.set(factory.kind, factory)
}

export function createProvider(config: ProviderConfig): SyncProvider {
  const factory = factories.get(config.kind)
  if (!factory) {
    throw new SyncProviderError(
      "NOT_FOUND",
      config.kind,
      `No sync provider factory registered for kind: ${config.kind}`,
      false
    )
  }
  return factory.create(config)
}

export function getRegisteredKinds(): string[] {
  return Array.from(factories.keys())
}
