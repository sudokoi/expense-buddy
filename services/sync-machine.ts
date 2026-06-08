import { setup, assign, fromPromise } from "xstate"
import type { SyncProvider } from "./sync/provider-types"
import { syncWithProvider, firstTimeSync } from "./sync/sync-with-provider"
import { Expense } from "../types/expense"
import type { AppSettings } from "./settings-manager"
import { TrueConflict, MergeResult } from "./merge-engine"
import i18next from "i18next"
import { logAsync } from "./logger"

export interface SyncCallbacks {
  onConflict?: (conflicts: TrueConflict[]) => void
  onSuccess?: (result: { mergeResult?: MergeResult; isFirstSync?: boolean }) => void
  onInSync?: () => void
  onError?: (error: string) => void
  onAuthError?: (info: { errorCode: string; shouldSignOut: boolean }) => void
}

export type ConflictResolver = (
  conflicts: TrueConflict[]
) => Promise<{ expenseId: string; choice: "local" | "remote" }[] | undefined>

export interface SyncMachineContext {
  provider: SyncProvider
  localExpenses: Expense[]
  dirtyDays?: string[]
  deletedDays?: string[]
  settings?: AppSettings
  syncSettingsEnabled: boolean
  callbacks: SyncCallbacks
  conflictResolver?: ConflictResolver
  pendingConflicts?: TrueConflict[]
  mergeResult?: MergeResult
  error?: string
  errorCode?: string
}

export type SyncMachineEvent =
  | {
      type: "SYNC"
      localExpenses: Expense[]
      dirtyDays?: string[]
      deletedDays?: string[]
      settings?: AppSettings
      syncSettingsEnabled: boolean
      callbacks?: SyncCallbacks
      conflictResolver?: ConflictResolver
      // The orchestrator's persisted per-provider reconciliation flag, supplied
      // on every SYNC. This is the single source of truth for the gate decision;
      // the machine does not keep its own copy in context.
      initialReconciliationComplete?: boolean
    }
  | {
      type: "RESOLVE_CONFLICTS"
      resolutions: { expenseId: string; choice: "local" | "remote" }[]
    }
  // Activation-driven trigger emitted by the orchestrator on provider
  // activation/rebind (and on manual retry / next launch) to advance the
  // awaitingInitialReconciliation gate into reconcilingFirstSync.
  | { type: "START_FIRST_SYNC" }
  | { type: "CANCEL" }
  | { type: "RESET" }

interface UnifiedSyncActorResult {
  success: boolean
  mergeResult?: MergeResult
  pendingConflicts?: TrueConflict[]
  error?: string
  errorCode?: string
  isInSync?: boolean
  isFirstSync?: boolean
}

export const syncMachine = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent,
    input: {} as { provider: SyncProvider },
  },
  actors: {
    unifiedSync: fromPromise<
      UnifiedSyncActorResult,
      {
        provider: SyncProvider
        localExpenses: Expense[]
        settings?: AppSettings
        syncSettingsEnabled: boolean
        dirtyDays?: string[]
        deletedDays?: string[]
        conflictResolver?: ConflictResolver
      }
    >(async ({ input }) => {
      const result = await syncWithProvider({
        provider: input.provider,
        localExpenses: input.localExpenses,
        localSettings: input.settings,
        syncSettingsEnabled: input.syncSettingsEnabled,
        dirtyDays: input.dirtyDays,
        deletedDays: input.deletedDays,
        conflictResolver: input.conflictResolver,
      })
      return result
    }),

    retryAfterConflict: fromPromise<
      UnifiedSyncActorResult,
      {
        provider: SyncProvider
        localExpenses: Expense[]
        settings?: AppSettings
        syncSettingsEnabled: boolean
        dirtyDays?: string[]
        deletedDays?: string[]
        conflictResolver?: ConflictResolver
        resolutions: { expenseId: string; choice: "local" | "remote" }[]
      }
    >(async ({ input }) => {
      const resolver =
        input.resolutions.length > 0
          ? async () => input.resolutions
          : input.conflictResolver
      const result = await syncWithProvider({
        provider: input.provider,
        localExpenses: input.localExpenses,
        localSettings: input.settings,
        syncSettingsEnabled: input.syncSettingsEnabled,
        dirtyDays: input.dirtyDays,
        deletedDays: input.deletedDays,
        conflictResolver: resolver,
      })
      return result
    }),

    firstTimeSync: fromPromise<
      UnifiedSyncActorResult,
      {
        provider: SyncProvider
        localExpenses: Expense[]
        settings?: AppSettings
        syncSettingsEnabled: boolean
      }
    >(async ({ input }) => {
      const result = await firstTimeSync(
        input.provider,
        input.localExpenses,
        input.settings,
        input.syncSettingsEnabled
      )
      return result
    }),
  },
  actions: {
    assignSyncContext: assign(({ event }) => {
      if (event.type !== "SYNC") return {}
      return {
        localExpenses: event.localExpenses,
        dirtyDays: event.dirtyDays,
        deletedDays: event.deletedDays,
        settings: event.settings,
        syncSettingsEnabled: event.syncSettingsEnabled,
        callbacks: event.callbacks || {},
        conflictResolver: event.conflictResolver,
        mergeResult: undefined,
        pendingConflicts: undefined,
        error: undefined,
        errorCode: undefined,
      }
    }),
  },
  delays: {
    SUCCESS_DISPLAY_TIME: 2000,
    ERROR_DISPLAY_TIME: 5000,
    IN_SYNC_DISPLAY_TIME: 100,
    CONFLICT_DISPLAY_TIME: 30000,
    SYNC_TIMEOUT: 60000,
  },
}).createMachine({
  id: "sync",
  initial: "idle",
  context: ({ input }) => ({
    provider: input.provider,
    localExpenses: [],
    syncSettingsEnabled: false,
    callbacks: {},
  }),
  states: {
    idle: {
      on: {
        SYNC: [
          {
            // Provider already reconciled on this device -> run a normal sync.
            guard: ({ event }) => event.initialReconciliationComplete === true,
            target: "syncing",
            actions: [
              "assignSyncContext",
              ({ context }) => {
                logAsync(
                  "INFO",
                  "SYNC_MACHINE",
                  `SYNC_STARTED expenseCount=${context.localExpenses.length} settingsSync=${context.syncSettingsEnabled}`
                )
              },
            ],
          },
          {
            // Not reconciled -> enter the REAL gate. Background auto-sync waits
            // here until the orchestrator emits START_FIRST_SYNC on activation.
            target: "awaitingInitialReconciliation",
            actions: [
              "assignSyncContext",
              () => {
                logAsync("INFO", "SYNC_MACHINE", "SYNC_AWAITING_INITIAL_RECONCILIATION")
              },
            ],
          },
        ],
      },
    },

    syncing: {
      entry: () => {
        logAsync("INFO", "SYNC_MACHINE", "SYNC_IN_PROGRESS")
      },
      after: {
        SYNC_TIMEOUT: {
          target: "error",
          actions: [
            assign({
              error: "Sync timed out after 60 seconds",
              errorCode: "TIMEOUT",
            }),
            () => {
              logAsync("ERROR", "SYNC_MACHINE", "SYNC_TIMEOUT")
            },
          ],
        },
      },
      invoke: {
        src: "unifiedSync",
        input: ({ context }) => ({
          provider: context.provider,
          localExpenses: context.localExpenses,
          settings: context.settings,
          syncSettingsEnabled: context.syncSettingsEnabled,
          dirtyDays: context.dirtyDays,
          deletedDays: context.deletedDays,
          conflictResolver: context.conflictResolver,
        }),
        onDone: [
          {
            guard: ({ event }) =>
              event.output.pendingConflicts !== undefined &&
              event.output.pendingConflicts.length > 0,
            target: "conflict",
            actions: [
              assign({
                pendingConflicts: ({ event }) => event.output.pendingConflicts,
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              ({ context, event }) => {
                if (event.output.pendingConflicts) {
                  context.callbacks.onConflict?.(event.output.pendingConflicts)
                }
                logAsync(
                  "WARN",
                  "SYNC_MACHINE",
                  `SYNC_CONFLICTS count=${event.output.pendingConflicts?.length ?? 0}`
                )
              },
            ],
          },
          {
            guard: ({ event }) => event.output.isInSync === true,
            target: "inSync",
            actions: [
              assign({
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              () => {
                logAsync("INFO", "SYNC_MACHINE", "SYNC_IN_SYNC")
              },
            ],
          },
          {
            guard: ({ event }) => event.output.isFirstSync === true,
            target: "awaitingInitialReconciliation",
            actions: [
              assign({
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              () => {
                logAsync("INFO", "SYNC_MACHINE", "FIRST_TIME_SYNC")
              },
            ],
          },
          {
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              assign({
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  mergeResult: event.output.mergeResult,
                })
              },
              () => {
                logAsync("INFO", "SYNC_MACHINE", "SYNC_SUCCESS")
              },
            ],
          },
          {
            target: "error",
            actions: [
              assign({
                mergeResult: ({ event }) => event.output.mergeResult,
                error: ({ event }) =>
                  event.output.error || i18next.t("githubSync.manager.syncFailed"),
                errorCode: ({ event }) => event.output.errorCode,
              }),
              ({ event }) => {
                logAsync(
                  "ERROR",
                  "SYNC_MACHINE",
                  `SYNC_FAILED error=${event.output.error ?? "unknown"} code=${event.output.errorCode ?? "none"}`
                )
              },
            ],
          },
        ],
        onError: {
          target: "error",
          actions: [
            assign({
              error: ({ event }) => formatMachineError(event.error),
            }),
            ({ event }) => {
              logAsync(
                "ERROR",
                "SYNC_MACHINE",
                `SYNC_INVOKE_ERROR error=${formatMachineError(event.error)}`
              )
            },
          ],
        },
      },
    },

    awaitingInitialReconciliation: {
      entry: () => {
        logAsync("INFO", "SYNC_MACHINE", "AWAITING_INITIAL_RECONCILIATION")
      },
      // No `after: { 0: ... }` auto-advance. This is the real gate: it advances
      // only on an explicit, activation-driven START_FIRST_SYNC emitted by the
      // orchestrator. Background SYNC events are ignored so auto-sync cannot
      // pass the gate before the first reconciliation succeeds.
      on: {
        START_FIRST_SYNC: "reconcilingFirstSync",
        SYNC: {
          // Ignored: background auto-sync stays gated (self-transition, no action).
          target: "awaitingInitialReconciliation",
        },
        RESET: "idle",
      },
    },

    reconcilingFirstSync: {
      invoke: {
        src: "firstTimeSync",
        input: ({ context }) => ({
          provider: context.provider,
          localExpenses: context.localExpenses,
          settings: context.settings,
          syncSettingsEnabled: context.syncSettingsEnabled,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              assign({
                mergeResult: ({ event }) => event.output.mergeResult,
              }),
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  mergeResult: event.output.mergeResult,
                  isFirstSync: true,
                })
              },
              () => {
                logAsync("INFO", "SYNC_MACHINE", "FIRST_TIME_SYNC_SUCCESS")
              },
            ],
          },
          {
            // Reconciliation failed -> stay gated. The orchestrator retries on
            // the next provider activation / app launch / manual retry.
            target: "awaitingInitialReconciliation",
            actions: [
              assign({
                error: ({ event }) =>
                  event.output.error || i18next.t("githubSync.manager.syncFailed"),
                errorCode: ({ event }) => event.output.errorCode,
              }),
              ({ event }) => {
                logAsync(
                  "ERROR",
                  "SYNC_MACHINE",
                  `FIRST_TIME_SYNC_FAILED error=${event.output.error ?? "unknown"} code=${event.output.errorCode ?? "none"}`
                )
              },
            ],
          },
        ],
        onError: {
          target: "awaitingInitialReconciliation",
          actions: [
            assign({
              error: ({ event }) => formatMachineError(event.error),
              errorCode: ({ event }) => extractMachineErrorCode(event.error),
            }),
            ({ event }) => {
              logAsync(
                "ERROR",
                "SYNC_MACHINE",
                `FIRST_TIME_SYNC_INVOKE_ERROR error=${formatMachineError(event.error)}`
              )
            },
          ],
        },
      },
      // Defensive: a CANCEL during first reconciliation abandons the attempt and
      // returns to the gate (stays unreconciled). No current caller sends this,
      // but without a handler the event would be silently dropped.
      on: {
        CANCEL: "awaitingInitialReconciliation",
      },
    },

    conflict: {
      after: {
        CONFLICT_DISPLAY_TIME: {
          target: "idle",
          actions: assign({
            pendingConflicts: undefined,
            error: undefined,
            errorCode: undefined,
          }),
        },
      },
      on: {
        RESOLVE_CONFLICTS: {
          target: "pushing",
        },
        CANCEL: {
          target: "idle",
          actions: assign({
            pendingConflicts: undefined,
            error: undefined,
            errorCode: undefined,
          }),
        },
        RESET: "idle",
      },
    },

    pushing: {
      invoke: {
        src: "retryAfterConflict",
        input: ({ context, event }) => ({
          provider: context.provider,
          localExpenses: context.localExpenses,
          settings: context.settings,
          syncSettingsEnabled: context.syncSettingsEnabled,
          dirtyDays: context.dirtyDays,
          deletedDays: context.deletedDays,
          conflictResolver: context.conflictResolver,
          resolutions:
            event.type === "RESOLVE_CONFLICTS"
              ? event.resolutions
              : ([] as { expenseId: string; choice: "local" | "remote" }[]),
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              assign({
                mergeResult: ({ event }) => event.output.mergeResult,
                pendingConflicts: undefined,
              }),
              ({ context, event }) => {
                context.callbacks.onSuccess?.({
                  mergeResult: event.output.mergeResult,
                })
              },
            ],
          },
          {
            target: "error",
            actions: assign({
              mergeResult: ({ event }) => event.output.mergeResult,
              error: ({ event }) =>
                event.output.error || i18next.t("githubSync.manager.syncFailed"),
              errorCode: ({ event }) => event.output.errorCode,
            }),
          },
        ],
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) => formatMachineError(event.error),
          }),
        },
      },
    },

    inSync: {
      entry: ({ context }) => {
        context.callbacks.onSuccess?.({ mergeResult: context.mergeResult })
      },
      after: {
        IN_SYNC_DISPLAY_TIME: "idle",
      },
      on: {
        RESET: "idle",
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
      after: {
        ERROR_DISPLAY_TIME: {
          target: "idle",
          actions: assign({
            error: undefined,
            errorCode: undefined,
          }),
        },
      },
      entry: ({ context }) => {
        const errorCode = context.errorCode
        const isAuthError =
          errorCode === "AUTH_MISSING" ||
          errorCode === "AUTH_EXPIRED" ||
          errorCode === "AUTH_INVALID" ||
          errorCode === "PERMISSION_DENIED"

        if (isAuthError) {
          context.callbacks.onAuthError?.({
            errorCode,
            shouldSignOut:
              errorCode === "AUTH_INVALID" || errorCode === "PERMISSION_DENIED",
          })
        }

        context.callbacks.onError?.(
          context.error || i18next.t("githubSync.errors.unknown", { status: "unknown" })
        )

        logAsync(
          isAuthError ? "WARN" : "ERROR",
          "SYNC_MACHINE",
          `SYNC_ERROR_STATE error=${context.error ?? "unknown"} code=${errorCode ?? "none"} isAuthError=${isAuthError}`
        )
      },
      on: {
        RESET: "idle",
        SYNC: {
          target: "syncing",
          actions: assign({
            localExpenses: ({ event }) => event.localExpenses,
            dirtyDays: ({ event }) => event.dirtyDays,
            deletedDays: ({ event }) => event.deletedDays,
            settings: ({ event }) => event.settings,
            syncSettingsEnabled: ({ event }) => event.syncSettingsEnabled,
            callbacks: ({ event }) => event.callbacks || {},
            conflictResolver: ({ event }) => event.conflictResolver,
            error: undefined,
            errorCode: undefined,
            pendingConflicts: undefined,
          }),
        },
      },
    },
  },
})

export type SyncMachineState =
  | "idle"
  | "syncing"
  | "awaitingInitialReconciliation"
  | "reconcilingFirstSync"
  | "conflict"
  | "pushing"
  | "inSync"
  | "success"
  | "error"

export type ConflictResolution = { expenseId: string; choice: "local" | "remote" }

export type { TrueConflict, MergeResult }

function formatMachineError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Best-effort extraction of a structured error code from a thrown error.
 * Provider errors (`SyncProviderError`) carry a `code` (e.g. "NETWORK",
 * "AUTH_INVALID"); propagating it lets the orchestrator tell transient
 * transport failures apart from persistent ones (auth/permission/corrupt).
 */
function extractMachineErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null | undefined)?.code
  return typeof code === "string" ? code : undefined
}
