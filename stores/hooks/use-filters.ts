import { useEffect, useCallback, useMemo, useRef } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import type { AnalyticsFiltersState } from "../../services/analytics-filters-storage"
import type {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../../types/analytics"

const SEARCH_DEBOUNCE_MS = 300

export function useFilters() {
  const { filterStore: store } = useStoreContext()

  const timeWindow = useSelector(store, (s) => s.context.timeWindow)
  const selectedCategories = useSelector(store, (s) => s.context.selectedCategories)
  const selectedPaymentMethods = useSelector(
    store,
    (s) => s.context.selectedPaymentMethods
  )
  const selectedPaymentInstruments = useSelector(
    store,
    (s) => s.context.selectedPaymentInstruments
  )
  const selectedMonth = useSelector(store, (s) => s.context.selectedMonth)
  const selectedCurrency = useSelector(store, (s) => s.context.selectedCurrency)
  const searchQuery = useSelector(store, (s) => s.context.searchQuery)
  const minAmount = useSelector(store, (s) => s.context.minAmount)
  const maxAmount = useSelector(store, (s) => s.context.maxAmount)
  const isHydrated = useSelector(store, (s) => s.context.isHydrated)

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

  const applyFilters = useCallback(
    (newFilters: AnalyticsFiltersState) => {
      store.trigger.applyFilters({ filters: newFilters })
    },
    [store]
  )

  const setTimeWindow = useCallback(
    (tw: TimeWindow) => {
      store.trigger.setTimeWindow({ timeWindow: tw })
    },
    [store]
  )

  const setSelectedMonth = useCallback(
    (month: string | null) => {
      store.trigger.setSelectedMonth({ month })
    },
    [store]
  )

  const setSelectedCategories = useCallback(
    (categories: string[]) => {
      store.trigger.setSelectedCategories({ categories })
    },
    [store]
  )

  const setSelectedPaymentMethods = useCallback(
    (methods: PaymentMethodSelectionKey[]) => {
      store.trigger.setSelectedPaymentMethods({ methods })
    },
    [store]
  )

  const setSelectedPaymentInstruments = useCallback(
    (instruments: PaymentInstrumentSelectionKey[]) => {
      store.trigger.setSelectedPaymentInstruments({ instruments })
    },
    [store]
  )

  const setSelectedCurrency = useCallback(
    (currency: string | null) => {
      store.trigger.setSelectedCurrency({ currency })
    },
    [store]
  )

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setSearchQuery = useCallback(
    (query: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        store.trigger.setSearchQuery({ query })
      }, SEARCH_DEBOUNCE_MS)
    },
    [store]
  )

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const setAmountRange = useCallback(
    (min: number | null, max: number | null) => {
      store.trigger.setAmountRange({ min, max })
    },
    [store]
  )

  const reset = useCallback(() => {
    store.trigger.reset()
  }, [store])

  const markSaved = useCallback(() => {
    store.trigger.markSaved()
  }, [store])

  return {
    filters,
    activeCount,
    hasActive,
    isHydrated,
    applyFilters,
    setTimeWindow,
    setSelectedMonth,
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
