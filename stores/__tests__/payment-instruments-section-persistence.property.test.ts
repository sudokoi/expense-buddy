/**
 * Property-based tests for Payment Instruments Section Persistence
 *
 * For any toggle of the payment instruments section expanded state, the settings store
 * SHALL persist the new value, and subsequent reads SHALL return the persisted value.
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

const PAYMENT_INSTRUMENTS_EXPANDED_KEY = "payment_instruments_section_expanded"

function createTestSettingsStore(initialExpanded: boolean = false) {
  return createStore({
    context: {
      paymentInstrumentsSectionExpanded: initialExpanded,
    },

    on: {
      loadPaymentInstrumentsExpanded: (context, event: { expanded: boolean }) => ({
        ...context,
        paymentInstrumentsSectionExpanded: event.expanded,
      }),

      setPaymentInstrumentsExpanded: (context, event: { expanded: boolean }, enqueue) => {
        enqueue.effect(async () => {
          await mockAsyncStorage.setItem(
            PAYMENT_INSTRUMENTS_EXPANDED_KEY,
            event.expanded ? "true" : "false"
          )
        })

        return {
          ...context,
          paymentInstrumentsSectionExpanded: event.expanded,
        }
      },
    },
  })
}

async function loadExpandedStateFromStorage(): Promise<boolean> {
  const value = await mockAsyncStorage.getItem(PAYMENT_INSTRUMENTS_EXPANDED_KEY)
  return value === "true"
}

describe("Payment Instruments Section Persistence Properties", () => {
  beforeEach(() => {
    mockStorage.clear()
    jest.clearAllMocks()
  })

  describe("Property: Payment Instruments Section Persistence", () => {
    it("setPaymentInstrumentsExpanded SHALL update store state to the new value", () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (initialState, newState) => {
          const store = createTestSettingsStore(initialState)

          store.trigger.setPaymentInstrumentsExpanded({ expanded: newState })

          const { paymentInstrumentsSectionExpanded } = store.getSnapshot().context
          return paymentInstrumentsSectionExpanded === newState
        }),
        { numRuns: 100 }
      )
    })

    it("setPaymentInstrumentsExpanded SHALL persist the value to AsyncStorage", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()
          const store = createTestSettingsStore()

          store.trigger.setPaymentInstrumentsExpanded({ expanded })

          await new Promise((resolve) => setTimeout(resolve, 10))

          expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
            PAYMENT_INSTRUMENTS_EXPANDED_KEY,
            expanded ? "true" : "false"
          )

          const storedValue = mockStorage.get(PAYMENT_INSTRUMENTS_EXPANDED_KEY)
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

          store.trigger.setPaymentInstrumentsExpanded({ expanded })

          await new Promise((resolve) => setTimeout(resolve, 10))

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

            for (const expanded of toggleSequence) {
              store.trigger.setPaymentInstrumentsExpanded({ expanded })
              await new Promise((resolve) => setTimeout(resolve, 5))
            }

            const finalExpected = toggleSequence[toggleSequence.length - 1]
            const { paymentInstrumentsSectionExpanded } = store.getSnapshot().context
            const loadedValue = await loadExpandedStateFromStorage()

            return (
              paymentInstrumentsSectionExpanded === finalExpected &&
              loadedValue === finalExpected
            )
          }
        ),
        { numRuns: 50 }
      )
    }, 10000)

    it("loading persisted state SHALL restore the exact value", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()

          await mockAsyncStorage.setItem(
            PAYMENT_INSTRUMENTS_EXPANDED_KEY,
            expanded ? "true" : "false"
          )

          const store = createTestSettingsStore()

          const loadedValue = await loadExpandedStateFromStorage()
          store.trigger.loadPaymentInstrumentsExpanded({ expanded: loadedValue })

          const { paymentInstrumentsSectionExpanded } = store.getSnapshot().context
          return paymentInstrumentsSectionExpanded === expanded
        }),
        { numRuns: 100 }
      )
    })

    it("toggle round-trip SHALL preserve the value", async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (expanded) => {
          mockStorage.clear()

          const store1 = createTestSettingsStore()
          store1.trigger.setPaymentInstrumentsExpanded({ expanded })
          await new Promise((resolve) => setTimeout(resolve, 10))

          const store2 = createTestSettingsStore()
          const loadedValue = await loadExpandedStateFromStorage()
          store2.trigger.loadPaymentInstrumentsExpanded({ expanded: loadedValue })

          const { paymentInstrumentsSectionExpanded } = store2.getSnapshot().context
          return paymentInstrumentsSectionExpanded === expanded
        }),
        { numRuns: 100 }
      )
    })
  })
})
