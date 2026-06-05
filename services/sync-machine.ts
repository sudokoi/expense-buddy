import { setup, assign, fromPromise } from "xstate"
import type { SyncProvider } from "./sync/provider-types"
import { syncWithProvider, firstTimeSync } from "./sync/sync-with-provider"
import { Expense } from "../types/expense"
import type { AppSettings } from "./settings-manager"
import { TrueConflict, MergeResult } from "./merge-engine"
import i18next from "i18next"

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
    }
  | {
      type: "RESOLVE_CONFLICTS"
      resolutions: { expenseId: string; choice: "local" | "remote" }[]
    }
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
      }
    >(async ({ input }) => {
      const result = await firstTimeSync(input.provider, input.localExpenses)
      return result
    }),
  },
  delays: {
    SUCCESS_DISPLAY_TIME: 2000,
    ERROR_DISPLAY_TIME: 5000,
    IN_SYNC_DISPLAY_TIME: 100,
    CONFLICT_DISPLAY_TIME: 30000,
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
            mergeResult: undefined,
            pendingConflicts: undefined,
            error: undefined,
            errorCode: undefined,
          }),
        },
      },
    },

    syncing: {
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
              },
            ],
          },
          {
            guard: ({ event }) => event.output.isInSync === true,
            target: "inSync",
            actions: assign({
              mergeResult: ({ event }) => event.output.mergeResult,
            }),
          },
          {
            guard: ({ event }) => event.output.isFirstSync === true,
            target: "awaitingInitialReconciliation",
            actions: assign({
              mergeResult: ({ event }) => event.output.mergeResult,
            }),
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

    awaitingInitialReconciliation: {
      after: {
        0: "reconcilingFirstSync",
      },
    },

    reconcilingFirstSync: {
      invoke: {
        src: "firstTimeSync",
        input: ({ context }) => ({
          provider: context.provider,
          localExpenses: context.localExpenses,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.success === true,
            target: "success",
            actions: [
              ({ context }) => {
                context.callbacks.onSuccess?.({ isFirstSync: true })
              },
            ],
          },
          {
            target: "error",
            actions: assign({
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
        context.callbacks.onInSync?.()
        context.callbacks.onSuccess?.({})
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
