/**
 * Regression tests for the standalone SyncOrchestrator (services/sync/sync-engine.ts).
 *
 * These drive the REAL XState sync machine (not a mock) through a fake
 * SyncProvider so the orchestrator <-> machine integration is exercised
 * end-to-end. This is the seam the original PR review caught: the orchestrator
 * parked the machine in `awaitingInitialReconciliation` and never emitted
 * `START_FIRST_SYNC`, so the activation-triggered first reconciliation timed
 * out after 60s and never completed.
 */
import { SyncOrchestrator, type SyncEngineDeps } from "../sync-engine"
import type { ProviderConfig, SyncProvider, SyncSnapshot } from "../provider-types"
import type { AppSettings } from "../../settings-manager"

const CONFIG: ProviderConfig = {
  id: "p1",
  kind: "github",
  label: "Test GitHub",
  credentialId: "cred-1",
  repo: "owner/repo",
} as ProviderConfig

function emptyRemoteSnapshot(): SyncSnapshot {
  return {
    manifest: {
      version: 1,
      generatedAt: new Date().toISOString(),
      appVersion: "test",
      files: [],
    },
    files: {},
    remoteRevision: { kind: "git_sha", sha: "remote-sha-1" },
  }
}

function makeProvider(
  readSnapshotImpl: () => Promise<SyncSnapshot | null>
): SyncProvider {
  return {
    kind: "github",
    providerId: "p1",
    testConnection: jest.fn(async () => ({ ok: true as const, label: "Test" })),
    readSnapshot: jest.fn(readSnapshotImpl),
    writeSnapshot: jest.fn(async () => {}),
    getStatus: jest.fn(async () => ({ connected: true, lastSyncTime: null })),
  }
}

function makeDeps(
  provider: SyncProvider,
  state: { reconciled: boolean }
): SyncEngineDeps {
  return {
    getActiveProviderConfig: async () => CONFIG,
    createProvider: () => provider,
    loadSettings: async () =>
      ({ autoSyncEnabled: true, syncSettings: false }) as unknown as AppSettings,
    getLocalExpenses: () => [],
    queue: {
      getSyncQueueWatermark: async () => 0,
      getProviderWatermark: async () => null,
      setProviderWatermark: async () => {},
      getSyncOpsSince: async () => [],
      clearSyncOpsUpTo: async () => {},
      getMinSyncedWatermark: async () => 0,
      isProviderReconciled: async () => state.reconciled,
      markProviderReconciled: async () => {
        state.reconciled = true
      },
    },
    dirtyDays: {
      load: async () => ({ dirtyDays: [], deletedDays: [] }),
      clear: async () => {},
    },
  }
}

describe("SyncOrchestrator first reconciliation", () => {
  it("drives activation-triggered first reconciliation to completion (no 60s gate timeout)", async () => {
    // No remote yet -> firstTimeSync initializes the remote and succeeds.
    const provider = makeProvider(async () => null)
    const state = { reconciled: false }
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state))

    await orchestrator.rebindProvider()

    // The machine reached reconcilingFirstSync via START_FIRST_SYNC and wrote
    // the initial snapshot; the provider is now flagged reconciled so background
    // auto-sync becomes eligible.
    expect(provider.writeSnapshot).toHaveBeenCalledTimes(1)
    expect(state.reconciled).toBe(true)
    expect(orchestrator.getState().lastError).toBeUndefined()
    expect(orchestrator.getState().machineState).toBe("idle")
  }, 10000)

  it("keeps the provider gated when first reconciliation fails", async () => {
    // readSnapshot throws -> firstTimeSync fails -> machine parks back in the
    // gate. The orchestrator must NOT mark the provider reconciled, and must
    // resolve promptly rather than hanging on the 60s timeout.
    const provider = makeProvider(async () => {
      throw new Error("network down")
    })
    const state = { reconciled: false }
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state))

    await orchestrator.rebindProvider()

    expect(provider.writeSnapshot).not.toHaveBeenCalled()
    expect(state.reconciled).toBe(false)
  }, 10000)

  it("runs the normal sync flow once the provider is reconciled", async () => {
    // Reconciled provider with an (empty) remote -> the machine routes straight
    // into `syncing` (not the gate) and settles in-sync.
    const provider = makeProvider(async () => emptyRemoteSnapshot())
    const state = { reconciled: true }
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state))

    const result = await orchestrator.manualSync()

    expect(provider.readSnapshot).toHaveBeenCalled()
    expect(result.skipped).not.toBe(true)
    expect(result.awaitingInitialReconciliation).not.toBe(true)
    expect(state.reconciled).toBe(true)
  }, 10000)

  it("notifies subscribers and exposes a stable, updated snapshot for the UI", async () => {
    const provider = makeProvider(async () => emptyRemoteSnapshot())
    const state = { reconciled: true }
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state))

    // getState() must be referentially stable between notifications so
    // useSyncExternalStore does not loop.
    const before = orchestrator.getState()
    expect(orchestrator.getState()).toBe(before)
    expect(before.running).toBe(false)
    expect(before.lastOutcome).toBe("idle")

    let notifications = 0
    const unsubscribe = orchestrator.subscribe(() => {
      notifications += 1
    })

    await orchestrator.manualSync()

    expect(notifications).toBeGreaterThan(0)
    const after = orchestrator.getState()
    expect(after).not.toBe(before)
    expect(after.running).toBe(false)
    expect(after.runVersion).toBeGreaterThan(before.runVersion)
    expect(["success", "in_sync"]).toContain(after.lastOutcome)

    // After unsubscribing, no further notifications are delivered.
    unsubscribe()
    const count = notifications
    await orchestrator.manualSync()
    expect(notifications).toBe(count)
  }, 10000)
})
