import { useCallback, useSyncExternalStore } from "react"
import {
  syncOrchestrator,
  type SyncEngineState,
  type SyncRunResult,
} from "../services/sync/sync-engine"

export interface UseSyncEngineReturn extends SyncEngineState {
  /**
   * True while a sync is actively running — covers both a normal run (`running`
   * flag) and the activation-triggered first reconciliation (which runs outside
   * the in-flight queue but drives the machine through `reconcilingFirstSync`).
   */
  isSyncing: boolean
  /** Trigger a user-initiated sync; resolves with the run result. */
  manualSync: () => Promise<SyncRunResult>
}

/**
 * Subscribe a component to the {@link syncOrchestrator}'s state. Backed by
 * `useSyncExternalStore`; `getState()` returns a cached, referentially-stable
 * snapshot so this does not loop.
 */
export function useSyncEngine(): UseSyncEngineReturn {
  const state = useSyncExternalStore(
    (onChange) => syncOrchestrator.subscribe(onChange),
    () => syncOrchestrator.getState(),
    () => syncOrchestrator.getState()
  )

  const isSyncing =
    state.running ||
    state.machineState === "syncing" ||
    state.machineState === "reconcilingFirstSync" ||
    state.machineState === "pushing"

  const manualSync = useCallback(() => syncOrchestrator.manualSync(), [])

  return { ...state, isSyncing, manualSync }
}
