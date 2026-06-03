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
 * This bridges the gap between synchronous React render-time
 * provider creation and asynchronous config loading.
 */
export class DeferredProvider implements SyncProvider {
  private inner: SyncProvider | null = null
  private resolvedKind: SyncProviderKind = "github"
  private resolvedId: string = "pending"
  private _resolved = false

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

  private ensure(): SyncProvider {
    if (!this.inner) {
      throw new SyncProviderError(
        "AUTH_MISSING",
        "github",
        "Sync not configured yet",
        false
      )
    }
    return this.inner
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.ensure().testConnection()
  }

  async readSnapshot(): Promise<SyncSnapshot | null> {
    return this.ensure().readSnapshot()
  }

  async writeSnapshot(
    snapshot: SyncSnapshot,
    lastKnownRevision: RemoteRevision | null
  ): Promise<void> {
    return this.ensure().writeSnapshot(snapshot, lastKnownRevision)
  }

  async getStatus(): Promise<ProviderStatus> {
    return this.ensure().getStatus()
  }
}
