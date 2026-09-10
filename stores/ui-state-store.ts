import { createStore } from "@xstate/store"
import { getItem, setItem } from "../services/storage"
import {
  loadDisplayDensity,
  loadDisplayDensitySync,
  saveDisplayDensity,
} from "../services/display-density-storage"
import {
  normalizeDisplayDensity,
  type DisplayDensity,
} from "../constants/display-density"

// keys for UI state persistence
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
    displayDensity: loadDisplayDensitySync(),
    densityHydrated: false,
    densityRevision: 0,
    paymentMethodSectionExpanded: false,
    paymentInstrumentsSectionExpanded: false,
  },

  on: {
    loadDisplayDensity: (
      context,
      event: { density: DisplayDensity; revision: number }
    ) => ({
      ...context,
      displayDensity:
        context.densityRevision === event.revision
          ? normalizeDisplayDensity(event.density)
          : context.displayDensity,
      densityHydrated: true,
    }),
    setDisplayDensity: (context, event: { density: DisplayDensity }, enqueue) => {
      const density = normalizeDisplayDensity(event.density)
      enqueue.effect(async () => {
        try {
          await saveDisplayDensity(density)
        } catch (error) {
          console.warn("Failed to persist display density:", error)
        }
      })
      return {
        ...context,
        displayDensity: density,
        densityRevision: context.densityRevision + 1,
        densityHydrated: true,
      }
    },
    /**
     * Load UI state from the device-local storage adapter
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
      // Persist locally, outside settings sync.
      enqueue.effect(async () => {
        await setItem(PAYMENT_METHOD_EXPANDED_KEY, event.expanded ? "true" : "false")
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
      // Persist locally, outside settings sync.
      enqueue.effect(async () => {
        await setItem(PAYMENT_INSTRUMENTS_EXPANDED_KEY, event.expanded ? "true" : "false")
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
export async function initializeUIStateStore(
  store: UIStateStore = uiStateStore
): Promise<void> {
  const revision = store.getSnapshot().context.densityRevision
  const densityLoad = loadDisplayDensity()
    .then((density) => store.trigger.loadDisplayDensity({ density, revision }))
    .catch(() =>
      store.trigger.loadDisplayDensity({
        density: store.getSnapshot().context.displayDensity,
        revision,
      })
    )
  try {
    const [expandedValue, instrumentsExpanded] = await Promise.all([
      getItem(PAYMENT_METHOD_EXPANDED_KEY),
      getItem(PAYMENT_INSTRUMENTS_EXPANDED_KEY),
    ])

    store.trigger.loadUIState({
      paymentMethodSectionExpanded: expandedValue === "true",
      paymentInstrumentsSectionExpanded: instrumentsExpanded === "true",
    })
  } catch (error) {
    console.warn("Failed to initialize UI state store:", error)
    // Use default values (false)
    store.trigger.loadUIState({
      paymentMethodSectionExpanded: false,
      paymentInstrumentsSectionExpanded: false,
    })
  } finally {
    await densityLoad
  }
}
