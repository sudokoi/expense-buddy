/**
 * React hook for the XState sync machine
 *
 * Provides a clean API for React components to interact with the sync state machine.
 * Uses callbacks passed to sync() instead of useEffect for side effects.
 * The sync actor is shared via StoreProvider context - all components see the same state.
 *
 * Updated for git-style sync with unified fetch-merge-push flow.
 */
import { useSelector } from "@xstate/react"
import { useCallback, useMemo } from "react"
import { Expense } from "../types/expense"
import { AppSettings } from "../services/settings-manager"
import {
  SyncMachineState,
  SyncCallbacks,
  ConflictResolver,
  TrueConflict,
  MergeResult,
  ConflictResolution,
  GitStyleSyncResult,
} from "../services/sync-machine"
import { useStoreContext } from "../stores/store-provider"

// Re-export types for convenience
export type {
  SyncCallbacks,
  ConflictResolver,
  TrueConflict,
  MergeResult,
  ConflictResolution,
  GitStyleSyncResult,
}

export interface SyncParams {
  localExpenses: Expense[]
  settings?: AppSettings
  syncSettingsEnabled: boolean
  callbacks?: SyncCallbacks
  /** Optional conflict resolver - if not provided, conflicts will pause sync */
  conflictResolver?: ConflictResolver
}

export interface UseSyncMachineReturn {
  // Current state
  state: SyncMachineState
  isIdle: boolean
  isSyncing: boolean
  isConflict: boolean
  isPushing: boolean
  isSuccess: boolean
  isError: boolean
  isInSync: boolean

  // Context data
  error?: string
  syncResult?: GitStyleSyncResult
  mergeResult?: MergeResult
  /** Pending conflicts that need resolution */
  pendingConflicts?: TrueConflict[]

  // Actions
  /** Start a sync operation */
  sync: (params: SyncParams) => void
  /** Resolve conflicts and continue sync */
  resolveConflicts: (resolutions: ConflictResolution[]) => void
  /** Cancel sync (from conflict state) */
  cancel: () => void
  /** Reset to idle state */
  reset: () => void
}

export function useSyncMachine(): UseSyncMachineReturn {
  const { syncActor } = useStoreContext()

  // Use useSelector to subscribe to actor state reactively
  const snapshot = useSelector(syncActor, (state) => state)

  // Extract current state string
  const state = snapshot.value as SyncMachineState

  // Derived state flags
  const isIdle = state === "idle"
  const isSyncing = state === "syncing"
  const isConflict = state === "conflict"
  const isPushing = state === "pushing"
  const isSuccess = state === "success"
  const isError = state === "error"
  const isInSync = state === "inSync"

  // Actions use the shared actor's send
  const sync = useCallback(
    (params: SyncParams) => {
      syncActor.send({
        type: "SYNC",
        localExpenses: params.localExpenses,
        settings: params.settings,
        syncSettingsEnabled: params.syncSettingsEnabled,
        callbacks: params.callbacks,
        conflictResolver: params.conflictResolver,
      })
    },
    [syncActor]
  )

  const resolveConflicts = useCallback(
    (resolutions: ConflictResolution[]) => {
      syncActor.send({
        type: "RESOLVE_CONFLICTS",
        resolutions,
      })
    },
    [syncActor]
  )

  const cancel = useCallback(() => {
    syncActor.send({ type: "CANCEL" })
  }, [syncActor])

  const reset = useCallback(() => {
    syncActor.send({ type: "RESET" })
  }, [syncActor])

  // Memoize context extraction to avoid unnecessary re-renders
  const contextData = useMemo(
    () => ({
      error: snapshot.context.error,
      syncResult: snapshot.context.syncResult,
      mergeResult: snapshot.context.mergeResult,
      pendingConflicts: snapshot.context.pendingConflicts,
    }),
    [snapshot.context]
  )

  return {
    state,
    isIdle,
    isSyncing,
    isConflict,
    isPushing,
    isSuccess,
    isError,
    isInSync,
    ...contextData,
    sync,
    resolveConflicts,
    cancel,
    reset,
  }
}
