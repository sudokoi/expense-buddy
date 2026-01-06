/**
 * XState v5 Sync Machine
 *
 * A state machine that manages the GitHub sync flow with explicit states and transitions.
 * Uses callbacks for side effects (notifications, alerts) instead of useEffect.
 *
 * XState v5 Best Practices Applied:
 * - Uses setup() for proper type inference
 * - Guards use inline functions in transitions for proper event typing
 * - Actions use assign() for context updates
 * - Callbacks are invoked in transition actions to access event.output directly
 * - Actors are defined in setup() for proper typing
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

/**
 * Pull result type for proper typing
 */
interface PullResult {
  success: boolean
  message: string
  expenses?: Expense[]
  settings?: AppSettings
  error?: string
}

// =============================================================================
// State Machine Definition
// =============================================================================

export const syncMachine = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent,
  },
  actors: {
    checkRemote: fromPromise<SyncDirectionResult, { hasLocalChanges: boolean }>(
      async ({ input }) => {
        return determineSyncDirection(input.hasLocalChanges)
      }
    ),
    push: fromPromise<
      SyncResult,
      { expenses: Expense[]; settings?: AppSettings; syncSettingsEnabled: boolean }
    >(async ({ input }) => {
      return syncUp(input.expenses, input.settings, input.syncSettingsEnabled)
    }),
    pull: fromPromise<PullResult, { syncSettingsEnabled: boolean }>(async ({ input }) => {
      return syncDown(7, input.syncSettingsEnabled)
    }),
  },
  delays: {
    SUCCESS_DISPLAY_TIME: 2000,
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
          // XState v5: Use inline guard functions for proper event.output typing
          {
            guard: ({ event }) => event.output.direction === "error",
            target: "error",
            actions: assign({
              directionResult: ({ event }) => event.output,
              error: ({ event }) => event.output.error,
            }),
          },
          {
            guard: ({ event }) => event.output.direction === "in_sync",
            target: "inSync",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
          {
            guard: ({ event }) => event.output.direction === "push",
            target: "pushing",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
          {
            guard: ({ event }) => event.output.direction === "pull",
            target: "pulling",
            actions: assign({
              directionResult: ({ event }) => event.output,
            }),
          },
          {
            guard: ({ event }) => event.output.direction === "conflict",
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
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              assign({
                syncResult: ({ event }) => event.output,
              }),
              // Invoke callback with event.output directly (not from context)
              // This ensures the callback receives the data immediately
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  syncResult: event.output,
                })
              },
            ],
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
            guard: ({ event }) => event.output.expenses !== undefined,
            target: "success",
            actions: [
              assign({
                downloadedExpenses: ({ event }) => event.output.expenses,
                downloadedSettings: ({ event }) => event.output.settings,
              }),
              // Invoke callback with event.output directly (not from context)
              // This ensures the callback receives the data immediately
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  downloadedExpenses: event.output.expenses,
                  downloadedSettings: event.output.settings,
                })
              },
            ],
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
      entry: ({ context }) => {
        context.callbacks.onConflict?.()
      },
      on: {
        FORCE_PUSH: "pushing",
        FORCE_PULL: "pulling",
        CANCEL: "idle",
      },
    },

    inSync: {
      entry: ({ context }) => {
        context.callbacks.onInSync?.()
      },
      after: {
        100: "idle",
      },
    },

    success: {
      // Callback is invoked in transition actions (pushing/pulling onDone)
      // to ensure it receives event.output data directly
      after: {
        SUCCESS_DISPLAY_TIME: "idle",
      },
      on: {
        RESET: "idle",
      },
    },

    error: {
      entry: ({ context }) => {
        context.callbacks.onError?.(context.error || "Unknown error")
      },
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
