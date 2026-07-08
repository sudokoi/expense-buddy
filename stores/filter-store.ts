import { createStore } from "@xstate/store"
import { useSelector } from "@xstate/store-react"
import { useEffect, useCallback, useMemo } from "react"
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
    setTimeWindow: (context, event: { timeWindow: TimeWindow }) => {
      // No-op when the window is unchanged and the month is already cleared,
      // so unrelated store events don't allocate a new context.
      if (context.timeWindow === event.timeWindow && context.selectedMonth === null) {
        return context
      }
      return {
        ...context,
        timeWindow: event.timeWindow,
        selectedMonth: null,
      }
    },

    setSelectedMonth: (context, event: { month: string | null }) => {
      const nextTimeWindow = event.month ? "all" : context.timeWindow
      // No-op when both the month and the derived time window are unchanged.
      if (
        context.selectedMonth === event.month &&
        context.timeWindow === nextTimeWindow
      ) {
        return context
      }
      return {
        ...context,
        selectedMonth: event.month,
        timeWindow: nextTimeWindow,
      }
    },

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
// Hook for components
// ============================================================================

export function useFilters() {
  // Use individual selectors for each filter property to avoid object creation
  const timeWindow = useSelector(filterStore, (s) => s.context.timeWindow)
  const selectedCategories = useSelector(filterStore, (s) => s.context.selectedCategories)
  const selectedPaymentMethods = useSelector(
    filterStore,
    (s) => s.context.selectedPaymentMethods
  )
  const selectedPaymentInstruments = useSelector(
    filterStore,
    (s) => s.context.selectedPaymentInstruments
  )
  const selectedMonth = useSelector(filterStore, (s) => s.context.selectedMonth)
  const selectedCurrency = useSelector(filterStore, (s) => s.context.selectedCurrency)
  const searchQuery = useSelector(filterStore, (s) => s.context.searchQuery)
  const minAmount = useSelector(filterStore, (s) => s.context.minAmount)
  const maxAmount = useSelector(filterStore, (s) => s.context.maxAmount)
  const isHydrated = useSelector(filterStore, (s) => s.context.isHydrated)

  // Memoize the filters object to maintain stable reference
  const filters = useMemo(
    () => ({
      timeWindow,
      selectedMonth,
      selectedCategories,
      selectedPaymentMethods,
      selectedPaymentInstruments,
      selectedCurrency,
      searchQuery,
      minAmount,
      maxAmount,
    }),
    [
      timeWindow,
      selectedMonth,
      selectedCategories,
      selectedPaymentMethods,
      selectedPaymentInstruments,
      selectedCurrency,
      searchQuery,
      minAmount,
      maxAmount,
    ]
  )

  // Calculate active count (primitive value, safe to calculate inline)
  const activeCount = useMemo(() => {
    let count = 0
    if (selectedMonth) {
      count++
    } else if (timeWindow !== "all") {
      count++
    }
    if (selectedCategories.length > 0) count++
    if (selectedPaymentMethods.length > 0) count++
    if (selectedPaymentInstruments.length > 0) count++
    if (searchQuery.trim()) count++
    if (minAmount !== null || maxAmount !== null) count++
    return count
  }, [
    timeWindow,
    selectedMonth,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    searchQuery,
    minAmount,
    maxAmount,
  ])

  const hasActive = activeCount > 0

  // Actions
  const applyFilters = useCallback((newFilters: AnalyticsFiltersState) => {
    filterStore.trigger.applyFilters({ filters: newFilters })
  }, [])

  const setTimeWindow = useCallback((timeWindow: TimeWindow) => {
    filterStore.trigger.setTimeWindow({ timeWindow })
  }, [])

  const setSelectedMonth = useCallback((month: string | null) => {
    filterStore.trigger.setSelectedMonth({ month })
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

  const reset = useCallback(() => {
    filterStore.trigger.reset()
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
    setSelectedMonth,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSelectedCurrency,
    reset,
  }
}

// ============================================================================
// Persistence Hook
// ============================================================================

export function useFilterPersistence() {
  // Load on mount — only hydrate once to avoid overwriting in-memory state
  // with stale storage values when multiple consumers mount (e.g., Filters screen
  // opening while History tab is already mounted and hydrated).
  useEffect(() => {
    if (filterStore.getSnapshot().context.isHydrated) return
    loadAnalyticsFilters().then((stored) => {
      // Double-check after async: another consumer may have hydrated while we awaited
      if (filterStore.getSnapshot().context.isHydrated) return
      filterStore.trigger.hydrate({ filters: stored })
    })
  }, [])

  // Save function (call only when filter sheet closes)
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
