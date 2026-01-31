import { createStore } from "@xstate/store"
import { useSelector } from "@xstate/store/react"
import { useEffect, useCallback, useMemo, useRef } from "react"
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

// Debounce delay for search queries (ms)
const SEARCH_DEBOUNCE_MS = 300

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
  const selectedCurrency = useSelector(filterStore, (s) => s.context.selectedCurrency)
  const searchQuery = useSelector(filterStore, (s) => s.context.searchQuery)
  const minAmount = useSelector(filterStore, (s) => s.context.minAmount)
  const maxAmount = useSelector(filterStore, (s) => s.context.maxAmount)
  const isHydrated = useSelector(filterStore, (s) => s.context.isHydrated)

  // Memoize the filters object to maintain stable reference
  const filters = useMemo(
    () => ({
      timeWindow,
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
    if (timeWindow !== "all") count++
    if (selectedCategories.length > 0) count++
    if (selectedPaymentMethods.length > 0) count++
    if (selectedPaymentInstruments.length > 0) count++
    if (searchQuery.trim()) count++
    if (minAmount !== null || maxAmount !== null) count++
    return count
  }, [
    timeWindow,
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

  // Debounced search query to reduce re-renders while typing
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setSearchQuery = useCallback((query: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      filterStore.trigger.setSearchQuery({ query })
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
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
