import type {
  SyncProvider,
  SyncProviderKind,
  SyncSnapshot,
  RemoteRevision,
  ConnectionTestResult,
  ProviderStatus,
} from "./provider-types"
import { SyncProviderError } from "./provider-types"

/**
 * A SyncProvider wrapper that starts unconfigured and can be resolved
 * to a real provider after async initialization completes.
 *
 * Resolution happens lazily on first method call:
 * - The `resolveFromConfig` callback is invoked to fetch the active config
 *   and create a provider.
 * - Or can be resolved eagerly via `resolve(provider)`.
 */
export class DeferredProvider implements SyncProvider {
  private inner: SyncProvider | null = null
  private resolvedKind: SyncProviderKind = "github"
  private resolvedId: string = "pending"
  private _resolved = false
  private resolving: Promise<SyncProvider> | null = null
  private readonly resolveFromConfig: () => Promise<SyncProvider>

  constructor(resolveFromConfig: () => Promise<SyncProvider>) {
    this.resolveFromConfig = resolveFromConfig
  }

  get kind(): SyncProviderKind {
    return this._resolved ? this.resolvedKind : "github"
  }

  get providerId(): string {
    return this._resolved ? this.resolvedId : "pending"
  }

  get isResolved(): boolean {
    return this._resolved
  }

  resolve(provider: SyncProvider): void {
    if (this._resolved) return
    this.inner = provider
    this.resolvedKind = provider.kind
    this.resolvedId = provider.providerId
    this._resolved = true
  }

  private async ensure(): Promise<SyncProvider> {
    if (this.inner) return this.inner
    if (this.resolving) return this.resolving

    this.resolving = this.tryResolve()
    try {
      return await this.resolving
    } finally {
      this.resolving = null
    }
  }

  private async tryResolve(): Promise<SyncProvider> {
    try {
      const provider = await this.resolveFromConfig()
      this.inner = provider
      this.resolvedKind = provider.kind
      this.resolvedId = provider.providerId
      this._resolved = true
      return this.inner
    } catch (error) {
      if (error instanceof SyncProviderError) throw error
      throw new SyncProviderError(
        "NOT_CONFIGURED",
        "github",
        "Sync not configured yet",
        false
      )
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return (await this.ensure()).testConnection()
  }

  async readSnapshot(): Promise<SyncSnapshot | null> {
    return (await this.ensure()).readSnapshot()
  }

  async writeSnapshot(
    snapshot: SyncSnapshot,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void> {
    return (await this.ensure()).writeSnapshot(snapshot, lastKnownRevision)
  }

  async getStatus(): Promise<ProviderStatus> {
    return (await this.ensure()).getStatus()
  }
}
