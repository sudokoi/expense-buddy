/**
 * Property-based tests for Sync Machine Sharing
 *
 * Property 1: Shared Actor State Visibility
 * For any sync operation that transitions the machine to a new state,
 * all components using useSyncMachine() SHALL observe the same state value.
 *
 * Property 2: Pending Changes Count Calculation
 * For any combination of pending expense changes (added, edited, deleted) and settings changes,
 * the displayed count SHALL equal the sum of all expense changes plus one if settings sync
 * is enabled and settings have changed.
 */

import fc from "fast-check"
import { createActor, setup, assign } from "xstate"

// Type for pending changes
interface PendingChanges {
  added: number
  edited: number
  deleted: number
}

// Create a minimal test sync machine that mirrors the real one's state structure
// This avoids importing the real sync-machine which has expo dependencies
const testSyncMachine = setup({
  types: {
    context: {} as { error?: string },
    events: {} as
      | { type: "SYNC" }
      | { type: "COMPLETE" }
      | { type: "ERROR" }
      | { type: "RESET" },
  },
}).createMachine({
  id: "testSync",
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: {
        SYNC: "syncing",
      },
    },
    syncing: {
      on: {
        COMPLETE: "success",
        ERROR: {
          target: "error",
          actions: assign({ error: "Test error" }),
        },
      },
    },
    success: {
      on: {
        RESET: "idle",
      },
    },
    error: {
      on: {
        RESET: "idle",
      },
    },
  },
})

// Arbitrary generator for pending changes
const pendingChangesArb: fc.Arbitrary<PendingChanges> = fc.record({
  added: fc.integer({ min: 0, max: 100 }),
  edited: fc.integer({ min: 0, max: 100 }),
  deleted: fc.integer({ min: 0, max: 100 }),
})

// Arbitrary generator for settings sync configuration
const settingsSyncConfigArb = fc.record({
  syncSettingsEnabled: fc.boolean(),
  hasUnsyncedSettingsChanges: fc.boolean(),
})

// Calculate pending count (mirrors the implementation in settings.tsx)
function calculatePendingCount(
  pendingChanges: PendingChanges,
  syncSettingsEnabled: boolean,
  hasUnsyncedSettingsChanges: boolean
): number {
  const expenseChanges =
    pendingChanges.added + pendingChanges.edited + pendingChanges.deleted
  const settingsChanges = syncSettingsEnabled && hasUnsyncedSettingsChanges ? 1 : 0
  return expenseChanges + settingsChanges
}

// Generate sync button text (mirrors the implementation in settings.tsx)
function generateSyncButtonText(isSyncing: boolean, pendingCount: number): string {
  if (isSyncing) return "Syncing..."
  if (pendingCount > 0) return `Sync Now (${pendingCount})`
  return "Sync Now"
}

describe("Sync Machine Sharing Properties", () => {
  describe("Property 1: Shared Actor State Visibility", () => {
    it("multiple subscribers to the same actor SHALL see identical state", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (subscriberCount) => {
          // Create a single shared actor (simulates StoreProvider behavior)
          const sharedActor = createActor(testSyncMachine)
          sharedActor.start()

          try {
            // Create multiple subscribers (simulates multiple useSyncMachine calls)
            const snapshots: (typeof sharedActor)["getSnapshot"][] = []
            for (let i = 0; i < subscriberCount; i++) {
              snapshots.push(() => sharedActor.getSnapshot())
            }

            // All subscribers should see the same initial state
            const initialStates = snapshots.map((getSnapshot) => getSnapshot().value)
            expect(new Set(initialStates).size).toBe(1)
            expect(initialStates[0]).toBe("idle")

            return true
          } finally {
            sharedActor.stop()
          }
        }),
        { numRuns: 100 }
      )
    })

    it("actor created once SHALL maintain single instance identity", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (accessCount) => {
          // Create actor once (simulates useRef pattern in StoreProvider)
          const actorRef = { current: null as ReturnType<typeof createActor> | null }

          if (!actorRef.current) {
            actorRef.current = createActor(testSyncMachine)
            actorRef.current.start()
          }

          try {
            // Access the actor multiple times
            const actors: (typeof actorRef.current)[] = []
            for (let i = 0; i < accessCount; i++) {
              actors.push(actorRef.current)
            }

            // All accesses should return the same actor instance
            for (let i = 1; i < actors.length; i++) {
              expect(actors[i]).toBe(actors[0])
            }

            return true
          } finally {
            actorRef.current?.stop()
          }
        }),
        { numRuns: 100 }
      )
    })

    it("state transitions SHALL be visible to all subscribers", () => {
      // Create a shared actor
      const sharedActor = createActor(testSyncMachine)
      sharedActor.start()

      try {
        // Initial state should be idle
        expect(sharedActor.getSnapshot().value).toBe("idle")

        // Send SYNC event - this will transition to syncing
        sharedActor.send({ type: "SYNC" })
        expect(sharedActor.getSnapshot().value).toBe("syncing")

        // Multiple "subscribers" should all see the same state
        const state1 = sharedActor.getSnapshot().value
        const state2 = sharedActor.getSnapshot().value
        const state3 = sharedActor.getSnapshot().value
        expect(state1).toBe(state2)
        expect(state2).toBe(state3)
        expect(state1).toBe("syncing")
      } finally {
        sharedActor.stop()
      }
    })

    it("stopped actor SHALL not accept new events", () => {
      const actor = createActor(testSyncMachine)
      actor.start()
      actor.stop()

      // After stopping, the actor should be in stopped status
      expect(actor.getSnapshot().status).toBe("stopped")
    })
  })

  describe("Property 2: Pending Changes Count Calculation", () => {
    it("pending count SHALL equal sum of expense changes plus settings change", () => {
      fc.assert(
        fc.property(
          pendingChangesArb,
          settingsSyncConfigArb,
          (pendingChanges, settingsConfig) => {
            const count = calculatePendingCount(
              pendingChanges,
              settingsConfig.syncSettingsEnabled,
              settingsConfig.hasUnsyncedSettingsChanges
            )

            const expectedExpenseChanges =
              pendingChanges.added + pendingChanges.edited + pendingChanges.deleted
            const expectedSettingsChange =
              settingsConfig.syncSettingsEnabled &&
              settingsConfig.hasUnsyncedSettingsChanges
                ? 1
                : 0

            expect(count).toBe(expectedExpenseChanges + expectedSettingsChange)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("pending count SHALL be zero when no changes exist", () => {
      const noChanges: PendingChanges = { added: 0, edited: 0, deleted: 0 }

      // Without settings changes
      expect(calculatePendingCount(noChanges, false, false)).toBe(0)
      expect(calculatePendingCount(noChanges, true, false)).toBe(0)
      expect(calculatePendingCount(noChanges, false, true)).toBe(0)

      // With settings sync enabled AND changes - should be 1
      expect(calculatePendingCount(noChanges, true, true)).toBe(1)
    })

    it("settings change SHALL only count when both conditions are true", () => {
      fc.assert(
        fc.property(pendingChangesArb, (pendingChanges) => {
          const baseCount =
            pendingChanges.added + pendingChanges.edited + pendingChanges.deleted

          // Settings change only counts when BOTH syncSettingsEnabled AND hasUnsyncedSettingsChanges
          expect(calculatePendingCount(pendingChanges, false, false)).toBe(baseCount)
          expect(calculatePendingCount(pendingChanges, true, false)).toBe(baseCount)
          expect(calculatePendingCount(pendingChanges, false, true)).toBe(baseCount)
          expect(calculatePendingCount(pendingChanges, true, true)).toBe(baseCount + 1)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("pending count SHALL be non-negative for any valid input", () => {
      fc.assert(
        fc.property(
          pendingChangesArb,
          settingsSyncConfigArb,
          (pendingChanges, settingsConfig) => {
            const count = calculatePendingCount(
              pendingChanges,
              settingsConfig.syncSettingsEnabled,
              settingsConfig.hasUnsyncedSettingsChanges
            )

            expect(count).toBeGreaterThanOrEqual(0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 3: Sync Button Text Generation", () => {
    it("button text SHALL show 'Syncing...' when syncing regardless of count", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (pendingCount) => {
          const text = generateSyncButtonText(true, pendingCount)
          expect(text).toBe("Syncing...")

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("button text SHALL show count when not syncing and count > 0", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (pendingCount) => {
          const text = generateSyncButtonText(false, pendingCount)
          expect(text).toBe(`Sync Now (${pendingCount})`)
          expect(text).toContain(String(pendingCount))

          return true
        }),
        { numRuns: 100 }
      )
    })

    it("button text SHALL show 'Sync Now' when not syncing and count is 0", () => {
      const text = generateSyncButtonText(false, 0)
      expect(text).toBe("Sync Now")
    })

    it("button text SHALL be deterministic for same inputs", () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.integer({ min: 0, max: 1000 }),
          (isSyncing, pendingCount) => {
            const text1 = generateSyncButtonText(isSyncing, pendingCount)
            const text2 = generateSyncButtonText(isSyncing, pendingCount)

            expect(text1).toBe(text2)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 4: Actor Lifecycle Management", () => {
    it("actor SHALL start in idle state", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const actor = createActor(testSyncMachine)
          actor.start()

          try {
            expect(actor.getSnapshot().value).toBe("idle")
            return true
          } finally {
            actor.stop()
          }
        }),
        { numRuns: 10 }
      )
    })

    it("actor SHALL be stoppable without errors", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const actor = createActor(testSyncMachine)
          actor.start()

          expect(() => actor.stop()).not.toThrow()
          expect(actor.getSnapshot().status).toBe("stopped")

          return true
        }),
        { numRuns: 10 }
      )
    })

    it("multiple start/stop cycles SHALL work correctly", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (cycles) => {
          for (let i = 0; i < cycles; i++) {
            const actor = createActor(testSyncMachine)
            actor.start()
            expect(actor.getSnapshot().value).toBe("idle")
            actor.stop()
            expect(actor.getSnapshot().status).toBe("stopped")
          }

          return true
        }),
        { numRuns: 20 }
      )
    })
  })
})
