/**
 * XState v5 Sync Machine - Git-Style Unified Flow
 *
 * A state machine that manages the GitHub sync flow with a unified fetch-merge-push approach.
 * Uses callbacks for side effects (notifications, alerts) instead of useEffect.
 *
 * State Flow:
 * idle → fetching → merging → [conflict] → pushing → success
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
  gitStyleSync,
  GitStyleSyncResult,
  ConflictResolution,
  loadSyncConfig,
} from "./sync-manager"
import { TrueConflict, MergeResult } from "./merge-engine"

// =============================================================================
// Types
// =============================================================================

/**
 * Callbacks for handling sync events - passed as input to avoid useEffect
 */
export interface SyncCallbacks {
  /** Called when true conflicts are detected that need user resolution */
  onConflict?: (conflicts: TrueConflict[]) => void
  /** Called when sync completes successfully */
  onSuccess?: (result: {
    syncResult?: GitStyleSyncResult
    mergeResult?: MergeResult
  }) => void
  /** Called when already in sync (no changes needed) */
  onInSync?: () => void
  /** Called when an error occurs */
  onError?: (error: string) => void
}

/**
 * Conflict resolution handler that returns user's choices
 */
export type ConflictResolver = (
  conflicts: TrueConflict[]
) => Promise<ConflictResolution[] | undefined>

export interface SyncMachineContext {
  // Input data
  localExpenses: Expense[]
  settings?: AppSettings
  syncSettingsEnabled: boolean

  // Callbacks for side effects
  callbacks: SyncCallbacks

  // Conflict resolution
  conflictResolver?: ConflictResolver
  pendingConflicts?: TrueConflict[]

  // Results
  syncResult?: GitStyleSyncResult
  mergeResult?: MergeResult

  // Error
  error?: string
}

export type SyncMachineEvent =
  | {
      type: "SYNC"
      localExpenses: Expense[]
      settings?: AppSettings
      syncSettingsEnabled: boolean
      callbacks?: SyncCallbacks
      conflictResolver?: ConflictResolver
    }
  | {
      type: "RESOLVE_CONFLICTS"
      resolutions: ConflictResolution[]
    }
  | { type: "CANCEL" }
  | { type: "RESET" }

/**
 * Result from the unified sync actor
 */
interface UnifiedSyncActorResult {
  success: boolean
  syncResult?: GitStyleSyncResult
  mergeResult?: MergeResult
  pendingConflicts?: TrueConflict[]
  error?: string
  isInSync?: boolean
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
    /**
     * Unified sync actor that performs fetch → merge → push
     * If conflicts are detected, it returns them for user resolution
     */
    unifiedSync: fromPromise<
      UnifiedSyncActorResult,
      {
        localExpenses: Expense[]
        settings?: AppSettings
        syncSettingsEnabled: boolean
        conflictResolver?: ConflictResolver
      }
    >(async ({ input }) => {
      // Check if sync is configured
      const config = await loadSyncConfig()
      if (!config) {
        return {
          success: false,
          error: "No sync configuration found",
        }
      }

      // Perform git-style sync with optional conflict resolver and settings
      const result = await gitStyleSync(
        input.localExpenses,
        input.conflictResolver,
        input.settings,
        input.syncSettingsEnabled
      )

      // Check if there are unresolved conflicts
      if (
        !result.success &&
        result.mergeResult?.trueConflicts &&
        result.mergeResult.trueConflicts.length > 0
      ) {
        return {
          success: false,
          syncResult: result,
          mergeResult: result.mergeResult,
          pendingConflicts: result.mergeResult.trueConflicts,
          error: result.error,
        }
      }

      // Check if already in sync (no changes made)
      if (
        result.success &&
        result.filesUploaded === 0 &&
        result.filesSkipped > 0 &&
        !result.settingsSynced &&
        result.mergeResult?.addedFromRemote.length === 0 &&
        result.mergeResult?.updatedFromRemote.length === 0
      ) {
        return {
          success: true,
          syncResult: result,
          mergeResult: result.mergeResult,
          isInSync: true,
        }
      }

      return {
        success: result.success,
        syncResult: result,
        mergeResult: result.mergeResult,
        error: result.error,
      }
    }),

    /**
     * Retry sync after conflict resolution
     */
    retryAfterConflict: fromPromise<
      UnifiedSyncActorResult,
      {
        localExpenses: Expense[]
        settings?: AppSettings
        syncSettingsEnabled: boolean
        resolutions: ConflictResolution[]
      }
    >(async ({ input }) => {
      // Create a resolver that returns the provided resolutions
      const resolver = async () => input.resolutions

      const result = await gitStyleSync(
        input.localExpenses,
        resolver,
        input.settings,
        input.syncSettingsEnabled
      )

      return {
        success: result.success,
        syncResult: result,
        mergeResult: result.mergeResult,
        error: result.error,
      }
    }),
  },
  delays: {
    SUCCESS_DISPLAY_TIME: 2000,
    IN_SYNC_DISPLAY_TIME: 100,
  },
}).createMachine({
  id: "sync",
  initial: "idle",
  context: {
    localExpenses: [],
    syncSettingsEnabled: false,
    callbacks: {},
  },
  states: {
    idle: {
      on: {
        SYNC: {
          target: "syncing",
          actions: assign({
            localExpenses: ({ event }) => event.localExpenses,
            settings: ({ event }) => event.settings,
            syncSettingsEnabled: ({ event }) => event.syncSettingsEnabled,
            callbacks: ({ event }) => event.callbacks || {},
            conflictResolver: ({ event }) => event.conflictResolver,
            // Clear previous results
            syncResult: undefined,
            mergeResult: undefined,
            pendingConflicts: undefined,
            error: undefined,
          }),
        },
      },
    },

    /**
     * Unified syncing state - performs fetch → merge → push
     * This replaces the old checkingRemote → pushing/pulling flow
     */
    syncing: {
      invoke: {
        src: "unifiedSync",
        input: ({ context }) => ({
          localExpenses: context.localExpenses,
          settings: context.settings,
          syncSettingsEnabled: context.syncSettingsEnabled,
          conflictResolver: context.conflictResolver,
        }),
        onDone: [
          // Check for conflicts that need resolution
          {
            guard: ({ event }) =>
              event.output.pendingConflicts !== undefined &&
              event.output.pendingConflicts.length > 0,
            target: "conflict",
            actions: [
              assign({
                pendingConflicts: ({ event }) => event.output.pendingConflicts,
                syncResult: ({ event }) => event.output.syncResult,
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              // Notify about conflicts
              ({ context, event }) => {
                if (event.output.pendingConflicts) {
                  context.callbacks.onConflict?.(event.output.pendingConflicts)
                }
              },
            ],
          },
          // Check if already in sync
          {
            guard: ({ event }) => event.output.isInSync === true,
            target: "inSync",
            actions: assign({
              syncResult: ({ event }) => event.output.syncResult,
              mergeResult: ({ event }) => event.output.mergeResult,
            }),
          },
          // Success case
          {
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              assign({
                syncResult: ({ event }) => event.output.syncResult,
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              // Invoke success callback
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  syncResult: event.output.syncResult,
                  mergeResult: event.output.mergeResult,
                })
              },
            ],
          },
          // Error case
          {
            target: "error",
            actions: assign({
              syncResult: ({ event }) => event.output.syncResult,
              mergeResult: ({ event }) => event.output.mergeResult,
              error: ({ event }) => event.output.error || "Sync failed",
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

    /**
     * Conflict state - waiting for user to resolve true conflicts
     * User can choose keep-local, keep-remote for each conflict, or cancel
     */
    conflict: {
      on: {
        RESOLVE_CONFLICTS: {
          target: "pushing",
          actions: assign({
            // Store resolutions for the retry
          }),
        },
        CANCEL: {
          target: "idle",
          actions: assign({
            pendingConflicts: undefined,
            error: undefined,
          }),
        },
      },
    },

    /**
     * Pushing state - retry sync after conflict resolution
     */
    pushing: {
      invoke: {
        src: "retryAfterConflict",
        input: ({ context, event }) => ({
          localExpenses: context.localExpenses,
          settings: context.settings,
          syncSettingsEnabled: context.syncSettingsEnabled,
          resolutions:
            event.type === "RESOLVE_CONFLICTS"
              ? event.resolutions
              : ([] as ConflictResolution[]),
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              assign({
                syncResult: ({ event }) => event.output.syncResult,
                mergeResult: ({ event }) => event.output.mergeResult,
                pendingConflicts: undefined,
              }),
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  syncResult: event.output.syncResult,
                  mergeResult: event.output.mergeResult,
                })
              },
            ],
          },
          {
            target: "error",
            actions: assign({
              syncResult: ({ event }) => event.output.syncResult,
              error: ({ event }) =>
                event.output.error || "Push failed after conflict resolution",
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

    inSync: {
      entry: ({ context }) => {
        context.callbacks.onInSync?.()
      },
      after: {
        IN_SYNC_DISPLAY_TIME: "idle",
      },
    },

    success: {
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
          target: "syncing",
          actions: assign({
            localExpenses: ({ event }) => event.localExpenses,
            settings: ({ event }) => event.settings,
            syncSettingsEnabled: ({ event }) => event.syncSettingsEnabled,
            callbacks: ({ event }) => event.callbacks || {},
            conflictResolver: ({ event }) => event.conflictResolver,
            error: undefined,
            pendingConflicts: undefined,
          }),
        },
      },
    },
  },
})

// Type exports for external use
export type SyncMachineState =
  | "idle"
  | "syncing"
  | "conflict"
  | "pushing"
  | "inSync"
  | "success"
  | "error"

// Re-export types for convenience
export type { TrueConflict, MergeResult, ConflictResolution, GitStyleSyncResult }
