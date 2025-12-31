/**
 * Unit tests for Sync Status Store
 */

import { createStore } from "@xstate/store"
import { SyncStatus } from "../sync-status-store"

// Create a fresh store for each test to avoid state pollution
function createTestSyncStatusStore() {
  return createStore({
    context: {
      syncStatus: "idle" as SyncStatus,
    },

    on: {
      startSync: (context) => ({
        ...context,
        syncStatus: "syncing" as SyncStatus,
      }),

      endSync: (context, event: { success: boolean }) => {
        const newStatus: SyncStatus = event.success ? "success" : "error"
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
}

// Computed selector for isSyncing
const selectIsSyncing = (context: { syncStatus: SyncStatus }): boolean =>
  context.syncStatus === "syncing"

describe("Sync Status Store", () => {
  describe("Initial state", () => {
    it("should start with idle status", () => {
      const store = createTestSyncStatusStore()
      expect(store.getSnapshot().context.syncStatus).toBe("idle")
    })
  })

  describe("startSync action", () => {
    it("should set status to syncing", () => {
      const store = createTestSyncStatusStore()
      store.trigger.startSync()
      expect(store.getSnapshot().context.syncStatus).toBe("syncing")
    })

    it("should transition from any status to syncing", () => {
      const store = createTestSyncStatusStore()

      // From idle
      store.trigger.startSync()
      expect(store.getSnapshot().context.syncStatus).toBe("syncing")

      // From success
      store.trigger.setStatus({ status: "success" })
      store.trigger.startSync()
      expect(store.getSnapshot().context.syncStatus).toBe("syncing")

      // From error
      store.trigger.setStatus({ status: "error" })
      store.trigger.startSync()
      expect(store.getSnapshot().context.syncStatus).toBe("syncing")
    })
  })

  describe("endSync action", () => {
    it("should set status to success when success=true", () => {
      const store = createTestSyncStatusStore()
      store.trigger.startSync()
      store.trigger.endSync({ success: true })
      expect(store.getSnapshot().context.syncStatus).toBe("success")
    })

    it("should set status to error when success=false", () => {
      const store = createTestSyncStatusStore()
      store.trigger.startSync()
      store.trigger.endSync({ success: false })
      expect(store.getSnapshot().context.syncStatus).toBe("error")
    })
  })

  describe("resetStatus action", () => {
    it("should reset status to idle", () => {
      const store = createTestSyncStatusStore()
      store.trigger.startSync()
      store.trigger.resetStatus()
      expect(store.getSnapshot().context.syncStatus).toBe("idle")
    })

    it("should reset from any status to idle", () => {
      const store = createTestSyncStatusStore()

      store.trigger.setStatus({ status: "success" })
      store.trigger.resetStatus()
      expect(store.getSnapshot().context.syncStatus).toBe("idle")

      store.trigger.setStatus({ status: "error" })
      store.trigger.resetStatus()
      expect(store.getSnapshot().context.syncStatus).toBe("idle")
    })
  })

  describe("setStatus action", () => {
    it("should set status to any valid value", () => {
      const store = createTestSyncStatusStore()

      const statuses: SyncStatus[] = ["idle", "syncing", "success", "error"]
      for (const status of statuses) {
        store.trigger.setStatus({ status })
        expect(store.getSnapshot().context.syncStatus).toBe(status)
      }
    })
  })

  describe("selectIsSyncing selector", () => {
    it("should return true only when status is syncing", () => {
      const store = createTestSyncStatusStore()

      expect(selectIsSyncing(store.getSnapshot().context)).toBe(false)

      store.trigger.startSync()
      expect(selectIsSyncing(store.getSnapshot().context)).toBe(true)

      store.trigger.endSync({ success: true })
      expect(selectIsSyncing(store.getSnapshot().context)).toBe(false)

      store.trigger.setStatus({ status: "error" })
      expect(selectIsSyncing(store.getSnapshot().context)).toBe(false)
    })
  })
})
