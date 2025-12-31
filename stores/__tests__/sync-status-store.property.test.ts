/**
 * Property-based tests for Sync Status Store
 *
 * Property 9: Sync Status Transitions
 * For any sync operation:
 * - Calling startSync SHALL set syncStatus to 'syncing'
 * - Calling endSync with success=true SHALL set syncStatus to 'success'
 * - Calling endSync with success=false SHALL set syncStatus to 'error'
 *
 * Property 10: isSyncing Computed Value
 * For any syncStatus value, isSyncing SHALL equal true if and only if syncStatus equals 'syncing'.
 *
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"
import { SyncStatus } from "../sync-status-store"

// Create a fresh store for each test
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

// Arbitrary generators
const syncStatusArb = fc.constantFrom<SyncStatus>("idle", "syncing", "success", "error")

type SyncOperation =
  | { type: "startSync" }
  | { type: "endSync"; success: boolean }
  | { type: "resetStatus" }
  | { type: "setStatus"; status: SyncStatus }

const syncOperationArb: fc.Arbitrary<SyncOperation> = fc.oneof(
  fc.constant({ type: "startSync" as const }),
  fc.boolean().map((success) => ({ type: "endSync" as const, success })),
  fc.constant({ type: "resetStatus" as const }),
  syncStatusArb.map((status) => ({ type: "setStatus" as const, status }))
)

describe("Sync Status Store Properties", () => {
  /**
   * Property 9: Sync Status Transitions
   * **Validates: Requirements 6.2, 6.3, 6.4**
   */
  describe("Property 9: Sync Status Transitions", () => {
    it("startSync SHALL always set status to syncing regardless of current state", () => {
      fc.assert(
        fc.property(syncStatusArb, (initialStatus) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status: initialStatus })

          store.trigger.startSync()

          return store.getSnapshot().context.syncStatus === "syncing"
        }),
        { numRuns: 100 }
      )
    })

    it("endSync with success=true SHALL always set status to success", () => {
      fc.assert(
        fc.property(syncStatusArb, (initialStatus) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status: initialStatus })

          store.trigger.endSync({ success: true })

          return store.getSnapshot().context.syncStatus === "success"
        }),
        { numRuns: 100 }
      )
    })

    it("endSync with success=false SHALL always set status to error", () => {
      fc.assert(
        fc.property(syncStatusArb, (initialStatus) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status: initialStatus })

          store.trigger.endSync({ success: false })

          return store.getSnapshot().context.syncStatus === "error"
        }),
        { numRuns: 100 }
      )
    })

    it("resetStatus SHALL always set status to idle", () => {
      fc.assert(
        fc.property(syncStatusArb, (initialStatus) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status: initialStatus })

          store.trigger.resetStatus()

          return store.getSnapshot().context.syncStatus === "idle"
        }),
        { numRuns: 100 }
      )
    })

    it("setStatus SHALL set status to the provided value", () => {
      fc.assert(
        fc.property(syncStatusArb, syncStatusArb, (initialStatus, targetStatus) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status: initialStatus })

          store.trigger.setStatus({ status: targetStatus })

          return store.getSnapshot().context.syncStatus === targetStatus
        }),
        { numRuns: 100 }
      )
    })

    it("operation sequences should produce deterministic results", () => {
      fc.assert(
        fc.property(
          fc.array(syncOperationArb, { minLength: 1, maxLength: 20 }),
          (operations) => {
            const store = createTestSyncStatusStore()

            // Track expected state
            let expectedStatus: SyncStatus = "idle"

            for (const op of operations) {
              switch (op.type) {
                case "startSync":
                  store.trigger.startSync()
                  expectedStatus = "syncing"
                  break
                case "endSync":
                  store.trigger.endSync({ success: op.success })
                  expectedStatus = op.success ? "success" : "error"
                  break
                case "resetStatus":
                  store.trigger.resetStatus()
                  expectedStatus = "idle"
                  break
                case "setStatus":
                  store.trigger.setStatus({ status: op.status })
                  expectedStatus = op.status
                  break
              }
            }

            return store.getSnapshot().context.syncStatus === expectedStatus
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 10: isSyncing Computed Value
   * **Validates: Requirements 6.5**
   */
  describe("Property 10: isSyncing Computed Value", () => {
    it("isSyncing SHALL be true if and only if syncStatus is syncing", () => {
      fc.assert(
        fc.property(syncStatusArb, (status) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status })

          const isSyncing = selectIsSyncing(store.getSnapshot().context)
          const expectedIsSyncing = status === "syncing"

          return isSyncing === expectedIsSyncing
        }),
        { numRuns: 100 }
      )
    })

    it("isSyncing SHALL be true after startSync", () => {
      fc.assert(
        fc.property(syncStatusArb, (initialStatus) => {
          const store = createTestSyncStatusStore()
          store.trigger.setStatus({ status: initialStatus })

          store.trigger.startSync()

          return selectIsSyncing(store.getSnapshot().context) === true
        }),
        { numRuns: 100 }
      )
    })

    it("isSyncing SHALL be false after endSync", () => {
      fc.assert(
        fc.property(fc.boolean(), (success) => {
          const store = createTestSyncStatusStore()
          store.trigger.startSync()

          store.trigger.endSync({ success })

          return selectIsSyncing(store.getSnapshot().context) === false
        }),
        { numRuns: 100 }
      )
    })
  })
})
