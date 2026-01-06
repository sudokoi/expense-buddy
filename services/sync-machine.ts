/**
 * XState Sync Machine
 *
 * A state machine that manages the GitHub sync flow with explicit states and transitions.
 * Uses callbacks for side effects (notifications, alerts) instead of useEffect.
 */
import { setup, assign, fromPromise } from "xstate"
import { Expense } from "../types/expense"
import { AppSettings } from "./settings-manager"
import {
  syncUp,
  syncDown,
  determineSyncDirection,
  SyncResult,
  SyncDirectionResult,
} from "./sync-manager"

// =============================================================================
// Types
// =============================================================================

/**
 * Callbacks for handling sync events - passed as input to avoid useEffect
 */
export interface SyncCallbacks {
  onConflict?: () => void
  onSuccess?: (result: {
    syncResult?: SyncResult
    downloadedExpenses?: Expense[]
    downloadedSettings?: AppSettings
  }) => void
  onInSync?: () => void
  onError?: (error: string) => void
}

export interface SyncMachineContext {
  // Input data
  localExpenses: Expense[]
  settings?: AppSettings
  syncSettingsEnabled: boolean
  hasLocalChanges: boolean

  // Callbacks for side effects
  callbacks: SyncCallbacks

  // Results
  syncResult?: SyncResult
  downloadedExpenses?: Expense[]
  downloadedSettings?: AppSettings
  directionResult?: SyncDirectionResult

  // Error
  error?: string
}

export type SyncMachineEvent =
  | {
      type: "SYNC"
      localExpenses: Expense[]
      settings?: AppSettings
      syncSettingsEnabled: boolean
      hasLocalChanges: boolean
      callbacks?: SyncCallbacks
    }
  | { type: "FORCE_PUSH" }
  | { type: "FORCE_PULL" }
  | { type: "CANCEL" }
  | { type: "RESET" }

// =============================================================================
// Actors (Promise-based services)
// =============================================================================

const checkRemoteActor = fromPromise<SyncDirectionResult, { hasLocalChanges: boolean }>(
  async ({ input }) => {
    return determineSyncDirection(input.hasLocalChanges)
  }
)

const pushActor = fromPromise<
  SyncResult,
  { expenses: Expense[]; settings?: AppSettings; syncSettingsEnabled: boolean }
>(async ({ input }) => {
  return syncUp(input.expenses, input.settings, input.syncSettingsEnabled)
})

const pullActor = fromPromise<
  {
    success: boolean
    message: string
    expenses?: Expense[]
    settings?: AppSettings
    error?: string
  },
  { syncSettingsEnabled: boolean }
>(async ({ input }) => {
  return syncDown(7, input.syncSettingsEnabled)
})

// =============================================================================
// State Machine Definition
// =============================================================================

export const syncMachine = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent,
  },
  actors: {
    checkRemote: checkRemoteActor,
    push: pushActor,
    pull: pullActor,
  },
  guards: {
    shouldPush: ({ context }) => {
      return context.directionResult?.direction === "push"
    },
    shouldPull: ({ context }) => {
      return context.directionResult?.direction === "pull"
    },
    isConflict: ({ context }) => {
      return context.directionResult?.direction === "conflict"
    },
    isInSync: ({ context }) => {
      return context.directionResult?.direction === "in_sync"
    },
    isError: ({ context }) => {
      return context.directionResult?.direction === "error"
    },
    pushSucceeded: ({ context }) => {
      return context.syncResult?.success === true
    },
    pullSucceeded: ({ context }) => {
      return context.downloadedExpenses !== undefined
    },
  },
  actions: {
    // Callback actions - invoke the provided callbacks
    invokeOnConflict: ({ context }) => {
      context.callbacks.onConflict?.()
    },
    invokeOnSuccess: ({ context }) => {
      context.callbacks.onSuccess?.({
        syncResult: context.syncResult,
        downloadedExpenses: context.downloadedExpenses,
        downloadedSettings: context.downloadedSettings,
      })
    },
    invokeOnInSync: ({ context }) => {
      context.callbacks.onInSync?.()
    },
    invokeOnError: ({ context }) => {
      context.callbacks.onError?.(context.error || "Unknown error")
    },
  },
  delays: {
    SUCCESS_DISPLAY_TIME: 2000, // 2 seconds to show success state
  },
}).createMachine({
  id: "sync",
  initial: "idle",
  context: {
    localExpenses: [],
    syncSettingsEnabled: false,
    hasLocalChanges: false,
    callbacks: {},
  },
  states: {
    idle: {
      on: {
        SYNC: {
          target: "checkingRemote",
          actions: assign({
            localExpenses: ({ event }) => event.localExpenses,
            settings: ({ event }) => event.settings,
            syncSettingsEnabled: ({ event }) => event.syncSettingsEnabled,
            hasLocalChanges: ({ event }) => event.hasLocalChanges,
            callbacks: ({ event }) => event.callbacks || {},
            // Clear previous results
            syncResult: undefined,
            downloadedExpenses: undefined,
            downloadedSettings: undefined,
            directionResult: undefined,
            error: undefined,
          }),
        },
      },
    },

    checkingRemote: {
      invoke: {
        src: "checkRemote",
        input: ({ context }) => ({ hasLocalChanges: context.hasLocalChanges }),
        onDone: [
          {
            guard: "isError",
            target: "error",
            actions: assign({
              directionResult: ({ event }) => event.output,
              error: ({ event }) => event.output.error,
            }),
          },
          {
            guard: "isInSync",
            target: "inSync",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
          {
            guard: "shouldPush",
            target: "pushing",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
          {
            guard: "shouldPull",
            target: "pulling",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
          {
            guard: "isConflict",
            target: "conflict",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
        ],
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },

    pushing: {
      invoke: {
        src: "push",
        input: ({ context }) => ({
          expenses: context.localExpenses,
          settings: context.settings,
          syncSettingsEnabled: context.syncSettingsEnabled,
        }),
        onDone: [
          {
            guard: "pushSucceeded",
            target: "success",
            actions: assign({
              syncResult: ({ event }) => event.output,
            }),
          },
          {
            target: "error",
            actions: assign({
              syncResult: ({ event }) => event.output,
              error: ({ event }) => event.output.error || event.output.message,
            }),
          },
        ],
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },

    pulling: {
      invoke: {
        src: "pull",
        input: ({ context }) => ({
          syncSettingsEnabled: context.syncSettingsEnabled,
        }),
        onDone: [
          {
            guard: "pullSucceeded",
            target: "success",
            actions: assign({
              downloadedExpenses: ({ event }) => event.output.expenses,
              downloadedSettings: ({ event }) => event.output.settings,
            }),
          },
          {
            target: "error",
            actions: assign({
              error: ({ event }) => event.output.error || event.output.message,
            }),
          },
        ],
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => String(event.error),
          }),
        },
      },
    },

    conflict: {
      // Invoke callback on entry
      entry: "invokeOnConflict",
      on: {
        FORCE_PUSH: "pushing",
        FORCE_PULL: "pulling",
        CANCEL: "idle",
      },
    },

    inSync: {
      // Invoke callback on entry, then auto-reset
      entry: "invokeOnInSync",
      after: {
        // Auto-reset to idle after brief moment
        100: "idle",
      },
    },

    success: {
      // Invoke callback on entry
      entry: "invokeOnSuccess",
      after: {
        // Auto-reset after 2 seconds (for UI to show success state)
        SUCCESS_DISPLAY_TIME: "idle",
      },
      on: {
        // Allow manual reset
        RESET: "idle",
      },
    },

    error: {
      // Invoke callback on entry
      entry: "invokeOnError",
      on: {
        RESET: "idle",
        SYNC: {
          target: "checkingRemote",
          actions: assign({
            localExpenses: ({ event }) => event.localExpenses,
            settings: ({ event }) => event.settings,
            syncSettingsEnabled: ({ event }) => event.syncSettingsEnabled,
            hasLocalChanges: ({ event }) => event.hasLocalChanges,
            callbacks: ({ event }) => event.callbacks || {},
            error: undefined,
          }),
        },
      },
    },
  },
})

// Type exports for external use
export type SyncMachineState =
  | "idle"
  | "checkingRemote"
  | "pushing"
  | "pulling"
  | "conflict"
  | "inSync"
  | "success"
  | "error"
