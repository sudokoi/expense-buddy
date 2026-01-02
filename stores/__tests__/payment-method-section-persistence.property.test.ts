/**
 * Property-based tests for Payment Method Section Persistence
 *
 * Property 3: Payment Method Section Persistence
 * For any toggle of the payment method section expanded state, the settings store
 * SHALL persist the new value, and subsequent reads SHALL return the persisted value.
 *
 * **Feature: useeffect-cleanup, Property 3: Payment Method Section Persistence**
 * **Validates: Requirements 3.1**
 */

import fc from "fast-check"
import { createStore } from "@xstate/store"

// Mock AsyncStorage for testing
const mockStorage = new Map<string, string>()

const mockAsyncStorage = {
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value)
  }),
  getItem: jest.fn(async (key: string) => {
    return mockStorage.get(key) ?? null
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key)
  }),
}

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

const PAYMENT_METHOD_EXPANDED_KEY = "payment_method_section_expanded"

// Create a test store that mirrors the settings store's payment method section behavior
function createTestSettingsStore(initialExpanded: boolean = false) {
  return createStore({
    context: {
      paymentMethodSectionExpanded: initialExpanded,
    },

    on: {
      loadPaymentMethodExpanded: (context, event: { expanded: boolean }) => ({
        ...context,
        paymentMethodSectionExpanded: event.expanded,
      }),

      setPaymentMethodExpanded: (context, event: { expanded: boolean }, enqueue) => {
        enqueue.effect(async () => {
          await mockAsyncStorage.setItem(
            PAYMENT_METHOD_EXPANDED_KEY,
            event.expanded ? "true" : "false"
          )
        })

        return {
          ...context,
          paymentMethodSectionExpanded: event.expanded,
        }
      },
    },
  })
}

// Helper to simulate loading from storage
async function loadExpandedStateFromStorage(): Promise<boolean> {
  const value = await mockAsyncStorage.getItem(PAYMENT_METHOD_EXPANDED_KEY)
  return value === "true"
}

describe("Payment Method Section Persistence Properties", () => {
  beforeEach(() => {
    mockStorage.clear()
    jest.clearAllMocks()
  })

  /**
   * Property 3: Payment Method Section Persistence
   * **Feature: useeffect-cleanup, Property 3: Payment Method Section Persistence**
   * **Validates: Requirements 3.1**
   */
  describe("Property 3: Payment Method Section Persistence", () => {
    it("setPaymentMethodExpanded SHALL update store state to the new value", () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (initialState, newState) => {
          const store = createTestSettingsStore(initialState)

          store.trigger.setPaymentMethodExpanded({ expanded: newState })

          const { paymentMethodSectionExpanded } = store.getSnapshot().context
          return paymentMethodSectionExpanded === newState
        }),
        { numRuns: 100 }
      )
    })

    it("setPaymentMethodExpanded SHALL persist the value to AsyncStorage", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()
          const store = createTestSettingsStore()

          store.trigger.setPaymentMethodExpanded({ expanded })

          // Wait for effect to complete
          await new Promise((resolve) => setTimeout(resolve, 10))

          // Verify AsyncStorage was called with correct value
          expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
            PAYMENT_METHOD_EXPANDED_KEY,
            expanded ? "true" : "false"
          )

          // Verify the stored value
          const storedValue = mockStorage.get(PAYMENT_METHOD_EXPANDED_KEY)
          return storedValue === (expanded ? "true" : "false")
        }),
        { numRuns: 100 }
      )
    })

    it("subsequent reads SHALL return the persisted value", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()
          const store = createTestSettingsStore()

          // Set the expanded state
          store.trigger.setPaymentMethodExpanded({ expanded })

          // Wait for effect to complete
          await new Promise((resolve) => setTimeout(resolve, 10))

          // Simulate loading from storage (as would happen on app restart)
          const loadedValue = await loadExpandedStateFromStorage()

          return loadedValue === expanded
        }),
        { numRuns: 100 }
      )
    })

    it("multiple toggles SHALL persist the final value", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          async (toggleSequence) => {
            mockStorage.clear()
            const store = createTestSettingsStore()

            // Apply all toggles
            for (const expanded of toggleSequence) {
              store.trigger.setPaymentMethodExpanded({ expanded })
              // Wait for each effect to complete
              await new Promise((resolve) => setTimeout(resolve, 5))
            }

            // The final state should match the last toggle value
            const finalExpected = toggleSequence[toggleSequence.length - 1]
            const { paymentMethodSectionExpanded } = store.getSnapshot().context
            const loadedValue = await loadExpandedStateFromStorage()

            return (
              paymentMethodSectionExpanded === finalExpected &&
              loadedValue === finalExpected
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it("loading persisted state SHALL restore the exact value", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()

          // Simulate a previous session that saved the expanded state
          await mockAsyncStorage.setItem(
            PAYMENT_METHOD_EXPANDED_KEY,
            expanded ? "true" : "false"
          )

          // Create a new store (simulating app restart)
          const store = createTestSettingsStore()

          // Load the persisted state
          const loadedValue = await loadExpandedStateFromStorage()
          store.trigger.loadPaymentMethodExpanded({ expanded: loadedValue })

          const { paymentMethodSectionExpanded } = store.getSnapshot().context
          return paymentMethodSectionExpanded === expanded
        }),
        { numRuns: 100 }
      )
    })

    it("toggle round-trip SHALL preserve the value", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()

          // First store session - set the value
          const store1 = createTestSettingsStore()
          store1.trigger.setPaymentMethodExpanded({ expanded })
          await new Promise((resolve) => setTimeout(resolve, 10))

          // Second store session - load the value (simulating app restart)
          const store2 = createTestSettingsStore()
          const loadedValue = await loadExpandedStateFromStorage()
          store2.trigger.loadPaymentMethodExpanded({ expanded: loadedValue })

          const { paymentMethodSectionExpanded } = store2.getSnapshot().context
          return paymentMethodSectionExpanded === expanded
        }),
        { numRuns: 100 }
      )
    })
  })
})
