/**
 * React hook for the XState sync machine
 *
 * Provides a clean API for React components to interact with the sync state machine.
 * Uses callbacks passed to sync() instead of useEffect for side effects.
 */
import { useMachine } from "@xstate/react"
import { useCallback, useMemo } from "react"
import { Expense } from "../types/expense"
import { AppSettings } from "../services/settings-manager"
import { syncMachine, SyncMachineState, SyncCallbacks } from "../services/sync-machine"

// Re-export for convenience
export type { SyncCallbacks }

export interface SyncParams {
  localExpenses: Expense[]
  settings?: AppSettings
  syncSettingsEnabled: boolean
  hasLocalChanges: boolean
  callbacks?: SyncCallbacks
}

export interface UseSyncMachineReturn {
  // Current state
  state: SyncMachineState
  isIdle: boolean
  isSyncing: boolean
  isConflict: boolean
  isSuccess: boolean
  isError: boolean
  isInSync: boolean

  // Context data
  error?: string
  syncResult?: {
    success: boolean
    message: string
    filesUploaded?: number
    filesSkipped?: number
    filesDeleted?: number
    settingsSynced?: boolean
    settingsSkipped?: boolean
  }
  downloadedExpenses?: Expense[]
  downloadedSettings?: AppSettings
  directionResult?: {
    direction: "push" | "pull" | "conflict" | "in_sync" | "error"
    localTime: string | null
    remoteTime: string | null
  }

  // Actions
  sync: (params: SyncParams) => void
  forcePush: () => void
  forcePull: () => void
  cancel: () => void
  reset: () => void
}

export function useSyncMachine(): UseSyncMachineReturn {
  const [snapshot, send] = useMachine(syncMachine)

  // Extract current state string
  const state = snapshot.value as SyncMachineState

  // Derived state flags
  const isIdle = state === "idle"
  const isSyncing =
    state === "checkingRemote" || state === "pushing" || state === "pulling"
  const isConflict = state === "conflict"
  const isSuccess = state === "success"
  const isError = state === "error"
  const isInSync = state === "inSync"

  // Actions
  const sync = useCallback(
    (params: SyncParams) => {
      send({
        type: "SYNC",
        localExpenses: params.localExpenses,
        settings: params.settings,
        syncSettingsEnabled: params.syncSettingsEnabled,
        hasLocalChanges: params.hasLocalChanges,
        callbacks: params.callbacks,
      })
    },
    [send]
  )

  const forcePush = useCallback(() => {
    send({ type: "FORCE_PUSH" })
  }, [send])

  const forcePull = useCallback(() => {
    send({ type: "FORCE_PULL" })
  }, [send])

  const cancel = useCallback(() => {
    send({ type: "CANCEL" })
  }, [send])

  const reset = useCallback(() => {
    send({ type: "RESET" })
  }, [send])

  // Memoize context extraction to avoid unnecessary re-renders
  const contextData = useMemo(
    () => ({
      error: snapshot.context.error,
      syncResult: snapshot.context.syncResult,
      downloadedExpenses: snapshot.context.downloadedExpenses,
      downloadedSettings: snapshot.context.downloadedSettings,
      directionResult: snapshot.context.directionResult,
    }),
    [snapshot.context]
  )

  return {
    state,
    isIdle,
    isSyncing,
    isConflict,
    isSuccess,
    isError,
    isInSync,
    ...contextData,
    sync,
    forcePush,
    forcePull,
    cancel,
    reset,
  }
}
