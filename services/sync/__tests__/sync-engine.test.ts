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
import type { Expense } from "../../../types/expense"
import { exportToCSV } from "../../csv-handler"
import { getFilenameForDay } from "../../daily-file-manager"
import { getLocalDayKey } from "../../../utils/date"

function makeExpense(date = "2025-06-01T00:00:00.000Z"): Expense {
  return {
    id: `exp-${date}`,
    amount: 100,
    category: "Food",
    note: "test",
    date,
    createdAt: date,
    updatedAt: date,
  } as Expense
}

function remoteSnapshotWith(expenses: Expense[]): SyncSnapshot {
  const files: Record<string, string> = {}
  for (const e of expenses) {
    files[getFilenameForDay(getLocalDayKey(e.date))] = exportToCSV([e])
  }
  return {
    manifest: {
      version: 1,
      generatedAt: new Date().toISOString(),
      appVersion: "test",
      files: [],
    },
    files,
    remoteRevision: { kind: "git_sha", sha: "remote-sha-with-data" },
  }
}

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
  state: { reconciled: boolean },
  localExpenses: Expense[] = []
): SyncEngineDeps {
  return {
    getActiveProviderConfig: async () => CONFIG,
    createProvider: () => provider,
    loadSettings: async () =>
      ({ autoSyncEnabled: true, syncSettings: false }) as unknown as AppSettings,
    getLocalExpenses: () => localExpenses,
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
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state, [makeExpense()]))

    await orchestrator.rebindProvider()

    // The machine reached reconcilingFirstSync via START_FIRST_SYNC and wrote
    // the initial snapshot; the provider is now flagged reconciled so background
    // auto-sync becomes eligible.
    expect(provider.writeSnapshot).toHaveBeenCalledTimes(1)
    expect(state.reconciled).toBe(true)
    expect(orchestrator.getState().lastError).toBeUndefined()
    expect(orchestrator.getState().machineState).toBe("idle")
  }, 10000)

  it("applies restored remote expenses to the store on first reconciliation", async () => {
    // Fresh device: remote already has data. firstTimeSync merges it; the
    // orchestrator must push the restored set to the store (onMerged) so it
    // shows up immediately, not on a later background sync.
    const restored = makeExpense("2025-06-01T00:00:00.000Z")
    const provider = makeProvider(async () => remoteSnapshotWith([restored]))
    const state = { reconciled: false }
    const deps = makeDeps(provider, state, [])
    const merged: Expense[][] = []
    deps.onMerged = (expenses) => merged.push(expenses)
    const orchestrator = new SyncOrchestrator(deps)

    await orchestrator.rebindProvider()

    expect(state.reconciled).toBe(true)
    expect(merged.length).toBeGreaterThan(0)
    const applied = merged[merged.length - 1]
    expect(applied.map((e) => e.id)).toContain(restored.id)
  }, 10000)

  it("completes first reconciliation without writing when there is nothing to initialize", async () => {
    // No remote and no local data -> firstTimeSync must NOT write an empty
    // snapshot, but reconciliation still completes so background sync unblocks.
    const provider = makeProvider(async () => null)
    const state = { reconciled: false }
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state, []))

    await orchestrator.rebindProvider()

    expect(provider.writeSnapshot).not.toHaveBeenCalled()
    expect(state.reconciled).toBe(true)
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

  it("returns a distinct promise for a run requested while another is in flight", async () => {
    // A manual run requested while a run is already in flight must NOT receive
    // the stale in-flight promise; it gets a promise bound to the coalesced
    // re-run instead (and that re-run actually completes).
    const provider = makeProvider(async () => emptyRemoteSnapshot())
    const state = { reconciled: true }
    const orchestrator = new SyncOrchestrator(makeDeps(provider, state))

    const p1 = orchestrator.manualSync()
    // inFlight is set synchronously by the first call, so this second call
    // queues behind it.
    const p2 = orchestrator.manualSync()

    expect(p1).not.toBe(p2)

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.skipped).not.toBe(true)
    expect(r2.skipped).not.toBe(true)
    // Two runs actually executed (the in-flight one + the coalesced re-run).
    expect((provider.readSnapshot as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
      2
    )
  }, 10000)

  it("recovers cleanly when a run times out (no leak, returns a failure)", async () => {
    // readSnapshot never resolves -> the machine never reaches a terminal state
    // -> waitFor times out. The orchestrator must tear the actor down, return a
    // handled failure (not reject), and leave its state consistent for the UI.
    const provider = makeProvider(() => new Promise(() => {}))
    const state = { reconciled: true }
    const deps = makeDeps(provider, state, [])
    deps.runTimeoutMs = 50
    const orchestrator = new SyncOrchestrator(deps)

    const result = await orchestrator.manualSync()

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe("TIMEOUT")
    const after = orchestrator.getState()
    expect(after.running).toBe(false)
    expect(after.machineState).toBe("idle")
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
