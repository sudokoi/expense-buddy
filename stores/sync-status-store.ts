import { createStore } from "@xstate/store"

export type SyncStatus = "idle" | "syncing" | "success" | "error"

export const syncStatusStore = createStore({
  context: {
    syncStatus: "idle" as SyncStatus,
  },

  on: {
    startSync: (context) => ({
      ...context,
      syncStatus: "syncing" as SyncStatus,
    }),

    endSync: (context, event: { success: boolean }, enqueue) => {
      const newStatus: SyncStatus = event.success ? "success" : "error"

      // Auto-reset success status after 2 seconds
      if (event.success) {
        enqueue.effect(() => {
          setTimeout(() => {
            syncStatusStore.trigger.resetStatus()
          }, 2000)
        })
      }

      return {
        ...context,
        syncStatus: newStatus,
      }
    },

    resetStatus: (context) => ({
      ...context,
      syncStatus: "idle" as SyncStatus,
    }),

    setStatus: (context, event: { status: SyncStatus }) => ({
      ...context,
      syncStatus: event.status,
    }),
  },
})

// Computed selector for isSyncing
type SyncStatusContext = typeof syncStatusStore extends {
  getSnapshot: () => { context: infer C }
}
  ? C
  : never

export const selectIsSyncing = (context: SyncStatusContext): boolean =>
  context.syncStatus === "syncing"

export type SyncStatusStore = typeof syncStatusStore
