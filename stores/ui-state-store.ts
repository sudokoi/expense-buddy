import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"

// AsyncStorage keys for UI state persistence
const PAYMENT_METHOD_EXPANDED_KEY = "payment_method_section_expanded"
const PAYMENT_INSTRUMENTS_EXPANDED_KEY = "payment_instruments_section_expanded"

/**
 * UI State Store
 *
 * Manages UI-specific state that should persist across app sessions
 * but is NOT part of the settings sync mechanism.
 *
 * This separation allows UI preferences to be device-specific while
 * settings remain synchronized across devices.
 */
export type UIStateStore = typeof uiStateStore

export const uiStateStore = createStore({
  context: {
    paymentMethodSectionExpanded: false,
    paymentInstrumentsSectionExpanded: false,
  },

  on: {
    /**
     * Load UI state from AsyncStorage
     * Called during initialization
     */
    loadUIState: (
      context,
      event: {
        paymentMethodSectionExpanded: boolean
        paymentInstrumentsSectionExpanded: boolean
      }
    ) => {
      return {
        ...context,
        paymentMethodSectionExpanded: event.paymentMethodSectionExpanded,
        paymentInstrumentsSectionExpanded: event.paymentInstrumentsSectionExpanded,
      }
    },

    /**
     * Toggle payment method section expanded state
     */
    setPaymentMethodExpanded: (context, event: { expanded: boolean }, enqueue) => {
      // Persist to AsyncStorage
      enqueue.effect(async () => {
        await AsyncStorage.setItem(
          PAYMENT_METHOD_EXPANDED_KEY,
          event.expanded ? "true" : "false"
        )
      })

      return {
        ...context,
        paymentMethodSectionExpanded: event.expanded,
      }
    },

    /**
     * Toggle payment instruments section expanded state
     */
    setPaymentInstrumentsExpanded: (context, event: { expanded: boolean }, enqueue) => {
      // Persist to AsyncStorage
      enqueue.effect(async () => {
        await AsyncStorage.setItem(
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

/**
 * Initialize the UI state store by loading persisted values
 */
export async function initializeUIStateStore(): Promise<void> {
  try {
    const [expandedValue, instrumentsExpanded] = await Promise.all([
      AsyncStorage.getItem(PAYMENT_METHOD_EXPANDED_KEY),
      AsyncStorage.getItem(PAYMENT_INSTRUMENTS_EXPANDED_KEY),
    ])

    uiStateStore.trigger.loadUIState({
      paymentMethodSectionExpanded: expandedValue === "true",
      paymentInstrumentsSectionExpanded: instrumentsExpanded === "true",
    })
  } catch (error) {
    console.warn("Failed to initialize UI state store:", error)
    // Use default values (false)
    uiStateStore.trigger.loadUIState({
      paymentMethodSectionExpanded: false,
      paymentInstrumentsSectionExpanded: false,
    })
  }
}
