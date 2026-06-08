import { createActor, waitFor, type Actor } from "xstate"
import type { Expense } from "../../types/expense"
import type { SyncNotification } from "../../types/sync"
import type { AppSettings } from "../settings-manager"
import { loadSettings } from "../settings-manager"
import type { MergeResult, TrueConflict } from "../merge-engine"
import { syncMachine, type SyncMachineState } from "../sync-machine"
import type { ConflictResolver } from "../sync-machine"
import type { ProviderConfig, SyncProvider } from "./provider-types"
import { createProvider } from "./provider-registry"
import { getActiveProviderConfig } from "../sync-config"
import { providerStateStore } from "./provider-state-store"
import { loadDirtyDays, clearDirtyDays } from "../expense-dirty-days"
import {
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
  clearSyncOpsUpTo,
  getMinSyncedWatermark,
  getProviderWatermark,
  getSyncOpsSince,
  getSyncQueueWatermark,
  isProviderReconciled,
  markProviderReconciled,
  setProviderWatermark,
  type SyncQueueOp,
} from "../sync-queue"
import { logAsync } from "../logger"
import i18next from "i18next"

// Register provider factories at import time (mirrors auto-sync-service).
import "./index"

/**
 * Why a sync run was requested. Background reasons (`on_change`/`on_launch`)
 * are debounced/coalesced and are a no-op until the active provider has
 * completed its activation-triggered first reconciliation. `manual` and `retry`
 * bypass the debounce.
 */
export type SyncReason = "on_change" | "on_launch" | "manual" | "retry"

/**
 * The set of dirty/deleted day keys this device has pending for upload. Loaded
 * fresh at the start of every run so a burst of mutations is captured together.
 */
export interface DirtyDaySnapshot {
  dirtyDays: string[]
  deletedDays: string[]
}

/**
 * Queue / watermark accessor port. Injected so the orchestrator can be tested
 * without touching AsyncStorage. Defaults bind to `services/sync-queue.ts`.
 */
export interface SyncQueuePort {
  getSyncQueueWatermark(): Promise<number>
  getProviderWatermark(providerId: string): Promise<number | null>
  setProviderWatermark(providerId: string, watermark: number): Promise<void>
  getSyncOpsSince(watermark: number): Promise<SyncQueueOp[]>
  clearSyncOpsUpTo(watermark: number): Promise<void>
  getMinSyncedWatermark(): Promise<number>
  isProviderReconciled(providerId: string): Promise<boolean>
  markProviderReconciled(providerId: string): Promise<void>
}

/**
 * Dirty/deleted day accessor port. Defaults bind to
 * `services/expense-dirty-days.ts`.
 */
export interface DirtyDayPort {
  load(): Promise<DirtyDaySnapshot>
  clear(): Promise<void>
}

/**
 * Provider-scoped metadata accessor port. Backs the
 * `sync.providers.<providerId>.lastSyncTime` key (Requirement 11.1). Injected so
 * the orchestrator can be tested without touching AsyncStorage; defaults bind to
 * `services/sync/provider-state-store.ts`.
 */
export interface SyncMetadataPort {
  setLastSyncTime(providerId: string, isoTimestamp: string): Promise<void>
  getLastSyncTime(providerId: string): Promise<string | null>
}

/**
 * Dependencies for the orchestrator. Everything the engine touches outside its
 * own state is injected here so the engine stays a plain, testable object with
 * no React or store coupling.
 */
export interface SyncEngineDeps {
  /** Resolve the currently active provider configuration (or null). */
  getActiveProviderConfig: () => Promise<ProviderConfig | null>
  /** Construct a config-bound `SyncProvider`. */
  createProvider: (config: ProviderConfig) => SyncProvider
  /** Load current app settings (auto-sync flags, settings-sync toggle, etc). */
  loadSettings: () => Promise<AppSettings>
  /** Snapshot the current in-memory expense set to feed the merge. */
  getLocalExpenses: () => Expense[]
  /** Queue / watermark accessors. */
  queue: SyncQueuePort
  /** Dirty/deleted day accessors. */
  dirtyDays: DirtyDayPort
  /** Provider-scoped sync metadata accessors (last sync time, etc). */
  metadata?: SyncMetadataPort
  /** Push merged results back into the expense store. */
  onMerged?: (expenses: Expense[]) => void
  /** Surface settings downloaded from the remote. */
  onSettingsDownloaded?: (settings: AppSettings) => void
  /** Surface a user-facing sync notification. */
  onNotify?: (notification: SyncNotification) => void
  /** Resolve true conflicts surfaced by the merge engine. */
  conflictResolver?: ConflictResolver
  /** Surface an auth error (e.g. to clear sync config when shouldSignOut). */
  onAuthError?: (info: { errorCode: string; shouldSignOut: boolean }) => void
  /** Debounce window (ms) for coalescing background `requestSync` bursts. */
  debounceMs?: number
}

/**
 * Store-facing callbacks injected by the StoreProvider once the React tree is
 * mounted (task 12). The module-level singleton is constructed with default
 * service deps but no store coupling; `setStoreBindings` fills in the callbacks
 * so merged expenses, downloaded settings, and notifications route back into the
 * stores. Injection is idempotent and only overrides the bindings provided.
 */
export interface SyncEngineStoreBindings {
  /** Snapshot the current in-memory expense set to feed the merge. */
  getLocalExpenses?: () => Expense[]
  /** Push merged results back into the expense store. */
  onMerged?: (expenses: Expense[]) => void
  /** Surface settings downloaded from the remote. */
  onSettingsDownloaded?: (settings: AppSettings) => void
  /** Surface a user-facing sync notification. */
  onNotify?: (notification: SyncNotification) => void
  /** Resolve true conflicts surfaced by the merge engine. */
  conflictResolver?: ConflictResolver
  /** Surface an auth error (e.g. to clear sync config when shouldSignOut). */
  onAuthError?: (info: { errorCode: string; shouldSignOut: boolean }) => void
}

/**
 * Outcome of a single orchestrated run. The watermark/apply/notification fields
 * are populated by the reconcile step (task 7.3); the skeleton wires the shape.
 */
export interface SyncRunResult {
  skipped?: boolean
  awaitingInitialReconciliation?: boolean
  success?: boolean
  expenses?: Expense[]
  mergeResult?: MergeResult
  downloadedSettings?: AppSettings
  notification?: SyncNotification
  pendingConflicts?: TrueConflict[]
  error?: string
  errorCode?: string
  pendingExpenseOps?: boolean
}

/** Machine-facing snapshot the UI can read. */
export interface SyncEngineState {
  /** Latest observed machine state, or "idle" when no run is active. */
  machineState: SyncMachineState | "idle"
  /** True while a run is in flight. */
  running: boolean
  /** True when another run has been requested while one is in flight. */
  rerunPending: boolean
  /** Provider id the engine is currently bound to. */
  activeProviderId: string | null
  /** Last terminal error message, if any. */
  lastError?: string
  /** ISO timestamp of the last completed run. */
  lastRunAt?: string
  /** Outcome of the most recently completed run (for UI status display). */
  lastOutcome: SyncOutcome
  /** Monotonic counter incremented each time a run completes (lets the UI
   *  detect a fresh completion even when the outcome value is unchanged). */
  runVersion: number
}

/** Coarse outcome of the most recent completed run, for UI status display. */
export type SyncOutcome =
  | "idle"
  | "success"
  | "in_sync"
  | "error"
  | "conflict"
  | "skipped"

/** Public API surface of the orchestrator. */
export interface SyncEngine {
  /**
   * Inject the store-facing callbacks. Called once by the StoreProvider when the
   * React tree mounts so merged results / settings / notifications route back
   * into the stores. Idempotent.
   */
  setStoreBindings(bindings: SyncEngineStoreBindings): void
  /**
   * Idempotent, debounced signal. Coalesces bursts of `on_change`/`on_launch`
   * mutations into a single run. Background reasons are a no-op until the
   * active provider's activation-triggered first reconciliation succeeds.
   */
  requestSync(reason: SyncReason): void
  /** User-initiated sync. Resolves when the run completes. */
  manualSync(): Promise<SyncRunResult>
  /** Current machine-facing state for the UI. */
  getState(): SyncEngineState
  /**
   * Subscribe to state changes. Returns an unsubscribe function. Designed for
   * `useSyncExternalStore`: pair it with `getState()`, which returns a cached,
   * referentially-stable snapshot that only changes when state actually changes.
   */
  subscribe(listener: () => void): () => void
  /**
   * Re-bind to a newly activated provider (add/switch). Tears down the previous
   * actor best-effort and fires the activation-triggered first reconciliation.
   * Teardown failure never blocks the rebind.
   */
  rebindProvider(): Promise<void>
}

const DEFAULT_DEBOUNCE_MS = 400

/**
 * Bounded auto-retry policy for the write. Only `NETWORK`/`RATE_LIMITED`
 * outcomes are retried (see {@link SyncOrchestrator.scheduleWriteRetry});
 * `CONFLICT` is excluded and requires an explicit user action to re-push.
 */
const MAX_WRITE_RETRY_ATTEMPTS = 5
const RETRY_BASE_DELAY_MS = 1000
const RETRY_MAX_DELAY_MS = 30000
const RETRYABLE_WRITE_ERROR_CODES = new Set(["NETWORK", "RATE_LIMITED"])

type RunActor = Actor<typeof syncMachine>

/**
 * Standalone, testable owner of all sync side-effects. It owns the XState
 * machine actor lifecycle, the queue/watermark state, the dirty/deleted day
 * state, and the retry schedule. Stores only ever call `requestSync`.
 *
 * Task 7.1 establishes the skeleton: ports, the public API, single-in-flight +
 * re-run-pending serialization, and `on_change`/`on_launch` debounce/coalesce.
 * Task 7.2 adds first-sync gating (background runs are a no-op until the active
 * provider is reconciled) and activation-triggered first reconciliation in
 * `rebindProvider()`. Watermark advancement/apply/compaction/retry policy (7.3)
 * extends the clearly-marked hooks below.
 */
export class SyncOrchestrator implements SyncEngine {
  private readonly deps: SyncEngineDeps
  private readonly debounceMs: number

  // --- Serialization state: a single in-flight run + a re-run-pending flag. ---
  private inFlight: Promise<SyncRunResult> | null = null
  private rerunPending = false
  private pendingReason: SyncReason = "on_change"
  // Callers that arrive while a run is in flight wait here for the coalesced
  // re-run's result (so e.g. manualSync resolves with its own run, not a stale
  // background run's promise).
  private pendingWaiters: Array<{
    resolve: (result: SyncRunResult) => void
    reject: (error: unknown) => void
  }> = []

  // --- Debounce/coalesce state for background requests. ---
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  // --- Machine actor lifecycle (owned here, created per run). ---
  private currentActor: RunActor | null = null
  private machineState: SyncMachineState | "idle" = "idle"

  // --- Retry schedule state (policy details land in task 7.3). ---
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempts = 0

  // --- Provider binding + last-run bookkeeping. ---
  private activeProviderId: string | null = null
  private lastError: string | undefined
  private lastRunAt: string | undefined
  private lastOutcome: SyncOutcome = "idle"
  private runVersion = 0

  // --- Reactive snapshot for the UI (cached for useSyncExternalStore). ---
  private readonly listeners = new Set<() => void>()
  private stateSnapshot: SyncEngineState

  constructor(deps: SyncEngineDeps) {
    this.deps = deps
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.stateSnapshot = this.buildSnapshot()
  }

  /** Rebuild the cached snapshot and notify subscribers. */
  private emitChange(): void {
    this.stateSnapshot = this.buildSnapshot()
    for (const listener of this.listeners) {
      listener()
    }
  }

  private buildSnapshot(): SyncEngineState {
    return {
      machineState: this.machineState,
      running: this.inFlight !== null,
      rerunPending: this.rerunPending,
      activeProviderId: this.activeProviderId,
      lastError: this.lastError,
      lastRunAt: this.lastRunAt,
      lastOutcome: this.lastOutcome,
      runVersion: this.runVersion,
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setStoreBindings(bindings: SyncEngineStoreBindings): void {
    if (bindings.getLocalExpenses) {
      this.deps.getLocalExpenses = bindings.getLocalExpenses
    }
    if (bindings.onMerged) {
      this.deps.onMerged = bindings.onMerged
    }
    if (bindings.onSettingsDownloaded) {
      this.deps.onSettingsDownloaded = bindings.onSettingsDownloaded
    }
    if (bindings.onNotify) {
      this.deps.onNotify = bindings.onNotify
    }
    if (bindings.conflictResolver) {
      this.deps.conflictResolver = bindings.conflictResolver
    }
    if (bindings.onAuthError) {
      this.deps.onAuthError = bindings.onAuthError
    }
    logAsync("INFO", "SYNC_ENGINE", "STORE_BINDINGS_SET")
  }

  requestSync(reason: SyncReason): void {
    // Background reasons are debounced and coalesced: a burst of mutations
    // collapses into a single run fired after the quiet window.
    if (reason === "on_change" || reason === "on_launch") {
      this.pendingReason = reason
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null
        void this.trigger(this.pendingReason)
      }, this.debounceMs)
      return
    }

    // manual/retry bypass the debounce window.
    void this.trigger(reason)
  }

  manualSync(): Promise<SyncRunResult> {
    // Manual runs skip the debounce; serialization still applies so we never
    // start a parallel actor.
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    return this.trigger("manual")
  }

  getState(): SyncEngineState {
    return this.stateSnapshot
  }

  async rebindProvider(): Promise<void> {
    // Teardown of the previous actor is best-effort and must never block the
    // rebind (Requirement 2.7).
    try {
      this.currentActor?.stop()
    } catch (error) {
      logAsync("WARN", "SYNC_ENGINE", `REBIND_TEARDOWN_FAILED error=${String(error)}`)
    }
    this.currentActor = null
    this.machineState = "idle"

    const config = await this.deps.getActiveProviderConfig()
    this.activeProviderId = config?.id ?? null
    this.emitChange()
    logAsync(
      "INFO",
      "SYNC_ENGINE",
      `REBIND_PROVIDER activeProviderId=${this.activeProviderId ?? "null"}`
    )

    if (!config) {
      return
    }

    // Activation (provider add/switch) is the explicit first-sync trigger: fire
    // the activation-driven first reconciliation against the freshly-bound
    // provider (Requirements 4.1, 4.5). Reconciliation runs on a brand-new actor
    // so a failed teardown above can never block it.
    await this.runFirstReconciliation(config)
  }

  /**
   * Activation-triggered first reconciliation for a newly-bound provider.
   *
   * Drives a single reconciliation through the machine and, on success, persists
   * the provider's `initialReconciliationComplete` flag (via
   * `markProviderReconciled`) so background auto-sync becomes eligible. On
   * failure/conflict the flag stays unset, so background `requestSync` remains a
   * no-op and the reconciliation is retried on the next activation/launch (or a
   * manual sync) — Requirements 4.5, 4.6.
   *
   * NOTE: once the real machine gate lands (task 8.1) this becomes an explicit
   * `START_FIRST_SYNC` send into a fresh actor. Against the current machine
   * contract the `SYNC` event drives the first-time-sync flow
   * (`awaitingInitialReconciliation` → `reconcilingFirstSync`), so the
   * orchestrator owns the persisted reconciliation flag here.
   */
  private async runFirstReconciliation(config: ProviderConfig): Promise<void> {
    const provider = this.deps.createProvider(config)
    const { dirtyDays, deletedDays } = await this.deps.dirtyDays.load()
    const localExpenses = this.deps.getLocalExpenses()
    const settings = await this.deps.loadSettings()

    logAsync(
      "INFO",
      "SYNC_ENGINE",
      `FIRST_RECONCILIATION_START providerId=${config.id} localCount=${localExpenses.length} dirty=${dirtyDays.length} deleted=${deletedDays.length}`
    )

    const final = await this.driveMachine({
      provider,
      localExpenses,
      dirtyDays,
      deletedDays,
      settings,
      initialReconciliationComplete: false,
    })

    this.lastRunAt = new Date().toISOString()

    if (final.matches("success") || final.matches("inSync")) {
      this.lastError = undefined
      await this.deps.queue.markProviderReconciled(config.id)
      // The first reconciliation wrote the full local+merged data, so every op
      // in the queue up to now is durably represented in the remote. Anchor the
      // provider's watermark at the current queue head so subsequent runs have a
      // well-defined boundary and don't lazily initialize it at an arbitrary
      // later point (which could swallow ops enqueued in between).
      const head = await this.deps.queue.getSyncQueueWatermark()
      await this.deps.queue.setProviderWatermark(config.id, head)
      await this.persistLastSyncTime(config.id)
      this.lastOutcome = "success"
      this.runVersion += 1
      this.emitChange()
      logAsync(
        "INFO",
        "SYNC_ENGINE",
        `FIRST_RECONCILIATION_SUCCESS providerId=${config.id} watermark=${head}`
      )
      return
    }

    // Not reconciled: keep background auto-sync gated and retry on next
    // activation/launch. Conflicts require explicit user resolution. A failed
    // first reconciliation parks back in `awaitingInitialReconciliation`, so the
    // terminal error lives in machine context rather than the `error` state.
    this.lastError = final.context.error ?? this.lastError
    this.lastOutcome = final.matches("conflict") ? "conflict" : "error"
    this.runVersion += 1
    this.emitChange()
    logAsync(
      "WARN",
      "SYNC_ENGINE",
      `FIRST_RECONCILIATION_INCOMPLETE providerId=${config.id} state=${String(final.value)}`
    )
  }

  /**
   * Serialize runs. If a run is already in flight, record that another run is
   * pending (coalescing the reason) and return the in-flight promise rather than
   * starting a parallel actor. When the active run settles, any pending re-run
   * is started.
   */
  private trigger(reason: SyncReason): Promise<SyncRunResult> {
    if (this.inFlight) {
      this.rerunPending = true
      this.pendingReason = reason
      // Return a promise bound to the NEXT (coalesced) run rather than the
      // in-flight one, so this caller receives the result of a run that actually
      // reflects its request instead of a stale, already-running background run.
      return new Promise<SyncRunResult>((resolve, reject) => {
        this.pendingWaiters.push({ resolve, reject })
      })
    }

    const run = this.runOnce(reason).finally(() => {
      this.inFlight = null
      this.emitChange()
      if (this.rerunPending) {
        this.rerunPending = false
        const nextReason = this.pendingReason
        const waiters = this.pendingWaiters
        this.pendingWaiters = []
        // Forward the re-run's outcome to everyone who queued behind this run.
        this.trigger(nextReason).then(
          (result) => waiters.forEach((w) => w.resolve(result)),
          (error) => waiters.forEach((w) => w.reject(error))
        )
      }
    })

    this.inFlight = run
    this.emitChange()
    return run
  }

  /**
   * Execute exactly one sync cycle: resolve config + settings, (gate background
   * runs — task 7.2), drive the machine actor over one SYNC, then reconcile the
   * watermark and apply merged results (task 7.3).
   */
  private async runOnce(reason: SyncReason): Promise<SyncRunResult> {
    const config = await this.deps.getActiveProviderConfig()
    if (!config) {
      return { skipped: true }
    }
    this.activeProviderId = config.id

    const settings = await this.deps.loadSettings()
    if (reason !== "manual" && reason !== "retry" && !settings.autoSyncEnabled) {
      return { skipped: true }
    }

    // First-sync gating hook. Task 7.2 makes background runs a no-op until the
    // active provider has completed its activation-triggered reconciliation.
    if (await this.isBackgroundGated(reason, config.id)) {
      return { skipped: true, awaitingInitialReconciliation: true }
    }

    const provider = this.deps.createProvider(config)
    const { dirtyDays, deletedDays } = await this.deps.dirtyDays.load()
    const localExpenses = this.deps.getLocalExpenses()

    // Route the machine correctly: a reconciled provider runs the normal sync
    // flow, while an unreconciled one (only reachable here via manual/retry,
    // since background runs are gated above) drives the activation first
    // reconciliation.
    const reconciled = await this.deps.queue.isProviderReconciled(config.id)

    logAsync(
      "INFO",
      "SYNC_ENGINE",
      `RUN_ONCE reason=${reason} providerId=${config.id} localCount=${localExpenses.length} dirty=${dirtyDays.length} deleted=${deletedDays.length} reconciled=${reconciled}`
    )

    const final = await this.driveMachine({
      provider,
      localExpenses,
      dirtyDays,
      deletedDays,
      settings,
      initialReconciliationComplete: reconciled,
    })

    this.lastRunAt = new Date().toISOString()

    // A manual/retry run that completed the first reconciliation must record the
    // reconciled flag so background auto-sync becomes eligible afterwards.
    if (!reconciled && (final.matches("success") || final.matches("inSync"))) {
      await this.deps.queue.markProviderReconciled(config.id)
    }

    const result = await this.reconcileWatermarkAndApply(config.id, final, localExpenses)
    this.recordOutcome(result)
    return result
  }

  /**
   * Derive the coarse UI outcome from a run result, bump the run version, and
   * notify subscribers. Called once per completed run.
   */
  private recordOutcome(result: SyncRunResult): void {
    if (result.skipped) {
      this.lastOutcome = "skipped"
    } else if (result.pendingConflicts && result.pendingConflicts.length > 0) {
      this.lastOutcome = "conflict"
    } else if (result.success === false) {
      this.lastOutcome = "error"
    } else if (result.mergeResult === undefined && result.success) {
      this.lastOutcome = "in_sync"
    } else {
      this.lastOutcome = "success"
    }
    this.runVersion += 1
    this.emitChange()
  }

  /**
   * Create, start, drive, and stop a machine actor for a single SYNC. The actor
   * is transient and owned by the orchestrator for the duration of the run.
   */
  private async driveMachine(args: {
    provider: SyncProvider
    localExpenses: Expense[]
    dirtyDays: string[]
    deletedDays: string[]
    settings: AppSettings
    /**
     * Whether the active provider has already completed its first
     * reconciliation on this device. Drives the machine's `idle` SYNC guard:
     * - `true`  → the machine routes straight into the normal `syncing` flow.
     * - `false` → the machine parks in the `awaitingInitialReconciliation` gate,
     *   so the orchestrator must emit an explicit `START_FIRST_SYNC` to drive
     *   the activation-triggered first reconciliation (see below).
     */
    initialReconciliationComplete: boolean
  }): Promise<ReturnType<RunActor["getSnapshot"]>> {
    const {
      provider,
      localExpenses,
      dirtyDays,
      deletedDays,
      settings,
      initialReconciliationComplete,
    } = args

    const actor = createActor(syncMachine, { input: { provider } })
    this.currentActor = actor
    const subscription = actor.subscribe((snapshot) => {
      this.machineState = snapshot.value as SyncMachineState
      this.emitChange()
    })
    actor.start()

    actor.send({
      type: "SYNC",
      localExpenses,
      dirtyDays,
      deletedDays,
      settings: settings.syncSettings ? settings : undefined,
      syncSettingsEnabled: settings.syncSettings,
      initialReconciliationComplete,
      callbacks: {
        onAuthError: (info) => {
          logAsync(
            "WARN",
            "SYNC_ENGINE",
            `AUTH_ERROR code=${info.errorCode} shouldSignOut=${info.shouldSignOut}`
          )
          this.deps.onAuthError?.(info)
        },
      },
      conflictResolver: this.deps.conflictResolver,
    })

    // When the provider has not yet reconciled, the SYNC above only parks the
    // machine in the `awaitingInitialReconciliation` gate (it ignores further
    // background SYNC events). Activation is the explicit first-sync trigger, so
    // we synchronously drive the gate into `reconcilingFirstSync` here. Both
    // sends are processed synchronously, so by the time we `waitFor` below the
    // machine has already left the transient gate state.
    if (!initialReconciliationComplete) {
      actor.send({ type: "START_FIRST_SYNC" })
    }

    const final = await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("success") ||
        snapshot.matches("inSync") ||
        snapshot.matches("error") ||
        snapshot.matches("conflict") ||
        // Reaching the gate here is terminal for a run: for a reconciled
        // provider the machine never enters it; for a first reconciliation we
        // have already passed the transient entry, so landing back here means
        // `reconcilingFirstSync` failed and parked the gate again.
        snapshot.matches("awaitingInitialReconciliation"),
      { timeout: 60000 }
    )

    subscription.unsubscribe()
    actor.stop()
    if (this.currentActor === actor) {
      this.currentActor = null
    }
    this.machineState = "idle"
    this.emitChange()

    return final
  }

  /**
   * First-sync gating decision for background runs.
   *
   * Background reasons (`on_change`/`on_launch`) are a no-op (zero
   * `writeSnapshot`) until the active provider has completed its
   * activation-triggered first reconciliation, tracked by the persisted
   * `isProviderReconciled` flag (Requirements 4.1, 4.6). `manual`/`retry` runs
   * are never gated. The first reconciliation itself is driven by
   * `rebindProvider()` on provider activation, not from here.
   */
  private async isBackgroundGated(
    reason: SyncReason,
    providerId: string
  ): Promise<boolean> {
    if (reason !== "on_change" && reason !== "on_launch") {
      return false
    }

    const reconciled = await this.deps.queue.isProviderReconciled(providerId)
    if (!reconciled) {
      logAsync(
        "INFO",
        "SYNC_ENGINE",
        `BACKGROUND_GATED reason=${reason} providerId=${providerId} awaitingInitialReconciliation`
      )
    }
    return !reconciled
  }

  /**
   * Apply un-acked ops on top of the merge result, advance the per-provider
   * watermark, clear dirty days, and compact the queue.
   *
   * Watermark/apply semantics (absorbed from `auto-sync-service.ts`):
   * - The watermark advances **only when both the run and `writeSnapshot`
   *   succeed** — i.e. the machine reached `success`/`inSync`. A failed write
   *   (`error`) or a `conflict` leaves the watermark unchanged and does **not**
   *   clear dirty days (Req 11.3).
   * - Un-acked ops (`id > watermark`) are applied on top of `mergeResult.merged`
   *   so local edits carry forward exactly once on a provider switch
   *   (Req 8.1, 8.2). Ops at or below the watermark are never re-applied
   *   (Req 8.3).
   * - A corrupt/inconsistent watermark — one that references an op id the queue
   *   never issued (`watermark > getSyncQueueWatermark()`) — **fails the sync and
   *   requires manual intervention** rather than silently resetting (Req 8.5).
   * - After advancing, the queue is compacted to the minimum watermark across
   *   reconciled providers (Req 11.4).
   *
   * On retryable transport failures (`NETWORK`/`RATE_LIMITED`) a bounded backoff
   * write retry is scheduled; `CONFLICT` is excluded from auto-retry-write
   * (Req 2.5, 6.6, 6.7).
   */
  private async reconcileWatermarkAndApply(
    providerId: string,
    final: ReturnType<RunActor["getSnapshot"]>,
    localExpenses: Expense[]
  ): Promise<SyncRunResult> {
    const context = final.context

    if (final.matches("error")) {
      this.lastError = context.error
      // A failed write leaves the watermark unchanged and the dirty-day set
      // intact (Req 11.3). Retryable transport errors schedule a bounded retry;
      // CONFLICT is never auto-retried here.
      this.scheduleWriteRetry(context.errorCode)
      return {
        success: false,
        error: context.error,
        errorCode: context.errorCode,
        mergeResult: context.mergeResult,
      }
    }

    if (final.matches("conflict")) {
      // CONFLICT triggers re-read + re-merge only (the machine's
      // conflict→pushing flow). The write retry requires an explicit user
      // action, so we never schedule an auto-retry-write here (Req 6.6, 6.7).
      return {
        success: false,
        pendingConflicts: context.pendingConflicts,
        mergeResult: context.mergeResult,
      }
    }

    if (final.matches("awaitingInitialReconciliation")) {
      return { skipped: true, awaitingInitialReconciliation: true }
    }

    // Reached here on `success` / `inSync`: both the run and (when needed) the
    // write succeeded, so it is safe to advance the watermark and clear dirty
    // days.
    this.lastError = undefined
    this.resetWriteRetry()

    // Resolve the provider watermark. A brand-new provider (post first
    // reconciliation) has no watermark yet: initialize it to the current queue
    // head so the full-data first sync's ops are treated as acknowledged.
    let watermark = await this.deps.queue.getProviderWatermark(providerId)
    if (watermark === null) {
      watermark = await this.deps.queue.getSyncQueueWatermark()
      await this.deps.queue.setProviderWatermark(providerId, watermark)
    }

    // Corruption guard: the watermark must never reference an op id beyond the
    // highest id the queue ever issued. If it does, fail the sync and require
    // manual intervention — never silently reset (Req 8.5).
    const queueHead = await this.deps.queue.getSyncQueueWatermark()
    if (watermark > queueHead) {
      const message = i18next.t("githubSync.manager.watermarkCorrupt", {
        defaultValue: "Sync watermark is inconsistent and requires manual intervention.",
      })
      this.lastError = message
      logAsync(
        "ERROR",
        "SYNC_ENGINE",
        `WATERMARK_CORRUPT providerId=${providerId} watermark=${watermark} queueHead=${queueHead}`
      )
      return {
        success: false,
        error: message,
        errorCode: "WATERMARK_CORRUPT",
        mergeResult: context.mergeResult,
      }
    }

    // Un-acked ops since the watermark — applied exactly once on top of the
    // merged result. Ops at or below the watermark are excluded by construction
    // (Req 8.3).
    const opsAfter = await this.deps.queue.getSyncOpsSince(watermark)
    const baseExpenses = context.mergeResult?.merged ?? localExpenses
    const reconciledExpenses = applyQueuedOpsToExpenses(baseExpenses, opsAfter)

    const hasSettingsOps = opsAfter.some(
      (op) => op.type.startsWith("settings.") || op.type.startsWith("category.")
    )
    const pendingExpenseOps = opsAfter.some((op) => op.type.startsWith("expense."))

    let reconciledSettings: AppSettings | undefined
    if (hasSettingsOps) {
      const currentSettings = await this.deps.loadSettings()
      reconciledSettings = applyQueuedOpsToSettings(currentSettings, opsAfter)
    }

    // Advance the watermark to the last applied op (or leave it where it is when
    // there were no new ops). This only runs on a successful run+write.
    const lastAppliedId =
      opsAfter.length > 0 ? opsAfter[opsAfter.length - 1].id : watermark
    if (lastAppliedId !== watermark) {
      await this.deps.queue.setProviderWatermark(providerId, lastAppliedId)
    }

    // Dirty/deleted days have now been durably pushed: clear them. (Only ever
    // reached on success — a failed write returns above without clearing.)
    await this.deps.dirtyDays.clear()

    // Compact the queue to the minimum watermark across reconciled providers
    // (Req 11.4). Unreconciled providers are excluded by `getMinSyncedWatermark`
    // so they don't block compaction.
    const minWatermark = await this.deps.queue.getMinSyncedWatermark()
    if (minWatermark > 0) {
      await this.deps.queue.clearSyncOpsUpTo(minWatermark)
    }

    // Record the provider-scoped last sync time now that the run+write
    // succeeded (Requirement 11.1).
    await this.persistLastSyncTime(providerId)

    // Build the user-facing notification from the merge result.
    const notification = this.buildSyncNotification(
      context.mergeResult,
      opsAfter.length > 0
    )

    // Push results back to the store/UI via the injected callbacks.
    this.deps.onMerged?.(reconciledExpenses)
    if (reconciledSettings) {
      this.deps.onSettingsDownloaded?.(reconciledSettings)
    }
    if (notification) {
      this.deps.onNotify?.(notification)
    }

    logAsync(
      "INFO",
      "SYNC_ENGINE",
      `RECONCILE_COMPLETE providerId=${providerId} watermark=${lastAppliedId} appliedOps=${opsAfter.length} minWatermark=${minWatermark} pendingExpenseOps=${pendingExpenseOps}`
    )

    return {
      success: true,
      expenses: reconciledExpenses,
      mergeResult: context.mergeResult,
      downloadedSettings: reconciledSettings,
      notification,
      pendingExpenseOps,
    }
  }

  /**
   * Build the post-sync notification. When un-acked ops remained at the end of
   * the run (the upload only pulled remote changes and local ops are still
   * pending), surface a "pending changes" message; otherwise report the merge
   * counts.
   */
  private buildSyncNotification(
    mergeResult: MergeResult | undefined,
    hasPendingOps: boolean
  ): SyncNotification | undefined {
    if (hasPendingOps) {
      return {
        localFilesUpdated: 0,
        remoteFilesUpdated: 0,
        message: i18next.t("settings.notifications.pendingChanges"),
      }
    }

    if (!mergeResult) {
      return undefined
    }

    const localFilesUpdated =
      (mergeResult.addedFromLocal.length ?? 0) +
      (mergeResult.updatedFromLocal.length ?? 0)
    const remoteFilesUpdated =
      (mergeResult.addedFromRemote.length ?? 0) +
      (mergeResult.updatedFromRemote.length ?? 0)

    return {
      localFilesUpdated,
      remoteFilesUpdated,
      message: i18next.t("settings.notifications.syncComplete", {
        localCount: localFilesUpdated,
        remoteCount: remoteFilesUpdated,
      }),
    }
  }

  /**
   * Schedule a bounded backoff retry of the write.
   *
   * Only `NETWORK` and `RATE_LIMITED` outcomes are auto-retried; every other
   * code (notably `CONFLICT`) is excluded — CONFLICT is resolved by re-read +
   * re-merge and an explicit user-initiated write (Req 2.5, 6.6, 6.7). Retries
   * are bounded by {@link MAX_WRITE_RETRY_ATTEMPTS} with exponential backoff
   * capped at {@link RETRY_MAX_DELAY_MS}. The retry is fired through
   * `requestSync("retry")` (which bypasses the debounce) and runs a fresh
   * read → merge → write cycle.
   */
  private scheduleWriteRetry(errorCode?: string): void {
    if (errorCode === undefined || !RETRYABLE_WRITE_ERROR_CODES.has(errorCode)) {
      return
    }

    if (this.retryAttempts >= MAX_WRITE_RETRY_ATTEMPTS) {
      logAsync(
        "WARN",
        "SYNC_ENGINE",
        `WRITE_RETRY_EXHAUSTED code=${errorCode} attempts=${this.retryAttempts}`
      )
      return
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }

    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** this.retryAttempts,
      RETRY_MAX_DELAY_MS
    )
    this.retryAttempts += 1
    logAsync(
      "INFO",
      "SYNC_ENGINE",
      `WRITE_RETRY_SCHEDULED code=${errorCode} attempt=${this.retryAttempts} delayMs=${delay}`
    )
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.requestSync("retry")
    }, delay)
  }

  /** Clear any pending write retry and reset the backoff counter after a run that succeeded. */
  private resetWriteRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.retryAttempts = 0
  }

  /**
   * Persist the provider-scoped last sync time
   * (`sync.providers.<providerId>.lastSyncTime`, Requirement 11.1). Best-effort:
   * a metadata write failure never fails the sync. No-op when no metadata port
   * is wired (e.g. lean test deps).
   */
  private async persistLastSyncTime(providerId: string): Promise<void> {
    const at = this.lastRunAt ?? new Date().toISOString()
    try {
      await this.deps.metadata?.setLastSyncTime(providerId, at)
    } catch (error) {
      logAsync(
        "WARN",
        "SYNC_ENGINE",
        `PERSIST_LAST_SYNC_TIME_FAILED providerId=${providerId} error=${String(error)}`
      )
    }
  }
}

/**
 * Default dependency wiring bound to the real services. Callbacks that route
 * results back into the stores (`onMerged`, `getLocalExpenses`, etc.) are filled
 * in when the StoreProvider wires the orchestrator in task 12.
 */
export function defaultSyncEngineDeps(): SyncEngineDeps {
  return {
    getActiveProviderConfig,
    createProvider,
    loadSettings,
    getLocalExpenses: () => [],
    queue: {
      getSyncQueueWatermark,
      getProviderWatermark,
      setProviderWatermark,
      getSyncOpsSince,
      clearSyncOpsUpTo,
      getMinSyncedWatermark,
      isProviderReconciled,
      markProviderReconciled,
    },
    dirtyDays: {
      load: async () => {
        const { state } = await loadDirtyDays()
        return { dirtyDays: state.dirtyDays, deletedDays: state.deletedDays }
      },
      clear: clearDirtyDays,
    },
    metadata: {
      setLastSyncTime: (providerId, isoTimestamp) =>
        providerStateStore.set(providerId, "lastSyncTime", isoTimestamp),
      getLastSyncTime: (providerId) =>
        providerStateStore.get<string>(providerId, "lastSyncTime"),
    },
  }
}

/**
 * Module-level singleton. Constructed with the real default deps; store wiring
 * (callbacks) is injected later. Tests construct their own `SyncOrchestrator`
 * with stub deps.
 */
export const syncOrchestrator = new SyncOrchestrator(defaultSyncEngineDeps())
