import { createStore } from "@xstate/store"
import { useCallback } from "react"
import {
  AnalyticsFiltersState,
  DEFAULT_ANALYTICS_FILTERS,
  loadAnalyticsFilters,
  saveAnalyticsFilters,
} from "../services/analytics-filters-storage"
import type {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../types/analytics"

interface FilterContext extends AnalyticsFiltersState {
  isHydrated: boolean
  hasUnsavedChanges: boolean
}

const initialContext: FilterContext = {
  ...DEFAULT_ANALYTICS_FILTERS,
  isHydrated: false,
  hasUnsavedChanges: false,
}

export const filterStore = createStore({
  context: initialContext,

  on: {
    // Hydrate from storage (batch update)
    hydrate: (context, event: { filters: AnalyticsFiltersState }) => ({
      ...context,
      ...event.filters,
      isHydrated: true,
    }),

    // Batch update all filters at once
    applyFilters: (context, event: { filters: AnalyticsFiltersState }) => ({
      ...context,
      ...event.filters,
      hasUnsavedChanges: true,
    }),

    // Individual filter updates (for real-time UI)
    setTimeWindow: (context, event: { timeWindow: TimeWindow }) => ({
      ...context,
      timeWindow: event.timeWindow,
      selectedMonth: null,
    }),

    setSelectedMonth: (context, event: { month: string | null }) => ({
      ...context,
      selectedMonth: event.month,
      timeWindow: event.month ? "all" : context.timeWindow,
    }),

    setSelectedCategories: (context, event: { categories: string[] }) => ({
      ...context,
      selectedCategories: event.categories,
    }),

    setSelectedPaymentMethods: (
      context,
      event: { methods: PaymentMethodSelectionKey[] }
    ) => ({
      ...context,
      selectedPaymentMethods: event.methods,
    }),

    setSelectedPaymentInstruments: (
      context,
      event: { instruments: PaymentInstrumentSelectionKey[] }
    ) => ({
      ...context,
      selectedPaymentInstruments: event.instruments,
    }),

    setSelectedCurrency: (context, event: { currency: string | null }) => ({
      ...context,
      selectedCurrency: event.currency,
    }),

    setSearchQuery: (context, event: { query: string }) => ({
      ...context,
      searchQuery: event.query,
    }),

    setAmountRange: (context, event: { min: number | null; max: number | null }) => ({
      ...context,
      minAmount: event.min,
      maxAmount: event.max,
    }),

    markSaved: (context) => ({
      ...context,
      hasUnsavedChanges: false,
    }),

    reset: () => ({
      ...initialContext,
      isHydrated: true,
    }),
  },
})

// ============================================================================
// Persistence Hook
// ============================================================================

export async function initializeFilterStore() {
  const stored = await loadAnalyticsFilters()
  filterStore.trigger.hydrate({ filters: stored })
}

export function useFilterPersistence() {
  const save = useCallback(async () => {
    const current = filterStore.getSnapshot().context
    await saveAnalyticsFilters({
      timeWindow: current.timeWindow,
      selectedMonth: current.selectedMonth,
      selectedCategories: current.selectedCategories,
      selectedPaymentMethods: current.selectedPaymentMethods,
      selectedPaymentInstruments: current.selectedPaymentInstruments,
      selectedCurrency: current.selectedCurrency,
      searchQuery: current.searchQuery,
      minAmount: current.minAmount,
      maxAmount: current.maxAmount,
    })
    filterStore.trigger.markSaved()
  }, [])

  return { save }
}
