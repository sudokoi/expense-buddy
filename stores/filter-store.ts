import { createStore } from "@xstate/store"
import { useSelector } from "@xstate/store/react"
import { useEffect, useCallback } from "react"
import {
  AnalyticsFiltersState,
  DEFAULT_ANALYTICS_FILTERS,
  loadAnalyticsFilters,
  saveAnalyticsFilters,
} from "../services/analytics-filters-storage"
import type { TimeWindow } from "../utils/analytics/time"
import type {
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../utils/analytics/filters"

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
// Selectors (optimized for minimal re-renders)
// ============================================================================

import type { StoreSnapshot } from "@xstate/store"

export const selectFilters = (
  snapshot: StoreSnapshot<FilterContext>
): AnalyticsFiltersState => ({
  timeWindow: snapshot.context.timeWindow,
  selectedCategories: snapshot.context.selectedCategories,
  selectedPaymentMethods: snapshot.context.selectedPaymentMethods,
  selectedPaymentInstruments: snapshot.context.selectedPaymentInstruments,
  selectedCurrency: snapshot.context.selectedCurrency,
  searchQuery: snapshot.context.searchQuery,
  minAmount: snapshot.context.minAmount,
  maxAmount: snapshot.context.maxAmount,
})

export const selectActiveFilterCount = (
  snapshot: StoreSnapshot<FilterContext>
): number => {
  let count = 0
  if (snapshot.context.timeWindow !== "all") count++
  if (snapshot.context.selectedCategories.length > 0) count++
  if (snapshot.context.selectedPaymentMethods.length > 0) count++
  if (snapshot.context.selectedPaymentInstruments.length > 0) count++
  if (snapshot.context.searchQuery.trim()) count++
  if (snapshot.context.minAmount !== null || snapshot.context.maxAmount !== null) count++
  return count
}

export const selectHasActiveFilters = (snapshot: StoreSnapshot<FilterContext>): boolean =>
  selectActiveFilterCount(snapshot) > 0

// ============================================================================
// Hook for components
// ============================================================================

export function useFilters() {
  const filters = useSelector(filterStore, selectFilters)
  const activeCount = useSelector(filterStore, selectActiveFilterCount)
  const hasActive = useSelector(filterStore, selectHasActiveFilters)
  const isHydrated = useSelector(filterStore, (snapshot) => snapshot.context.isHydrated)

  // Actions
  const applyFilters = useCallback((newFilters: AnalyticsFiltersState) => {
    filterStore.trigger.applyFilters({ filters: newFilters })
  }, [])

  const setTimeWindow = useCallback((timeWindow: TimeWindow) => {
    filterStore.trigger.setTimeWindow({ timeWindow })
  }, [])

  const setSelectedCategories = useCallback((categories: string[]) => {
    filterStore.trigger.setSelectedCategories({ categories })
  }, [])

  const setSelectedPaymentMethods = useCallback(
    (methods: PaymentMethodSelectionKey[]) => {
      filterStore.trigger.setSelectedPaymentMethods({ methods })
    },
    []
  )

  const setSelectedPaymentInstruments = useCallback(
    (instruments: PaymentInstrumentSelectionKey[]) => {
      filterStore.trigger.setSelectedPaymentInstruments({ instruments })
    },
    []
  )

  const setSelectedCurrency = useCallback((currency: string | null) => {
    filterStore.trigger.setSelectedCurrency({ currency })
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    filterStore.trigger.setSearchQuery({ query })
  }, [])

  const setAmountRange = useCallback((min: number | null, max: number | null) => {
    filterStore.trigger.setAmountRange({ min, max })
  }, [])

  const reset = useCallback(() => {
    filterStore.trigger.reset()
  }, [])

  const markSaved = useCallback(() => {
    filterStore.trigger.markSaved()
  }, [])

  return {
    // State
    filters,
    activeCount,
    hasActive,
    isHydrated,
    // Actions
    applyFilters,
    setTimeWindow,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSelectedCurrency,
    setSearchQuery,
    setAmountRange,
    reset,
    markSaved,
  }
}

// ============================================================================
// Persistence Hook
// ============================================================================

export function useFilterPersistence() {
  // Load on mount
  useEffect(() => {
    loadAnalyticsFilters().then((stored) => {
      filterStore.trigger.hydrate({ filters: stored })
    })
  }, [])

  // Save function (call only when filter sheet closes)
  const save = useCallback(async () => {
    const current = filterStore.getSnapshot().context
    await saveAnalyticsFilters({
      timeWindow: current.timeWindow,
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
