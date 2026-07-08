import { createContext, useContext, useMemo } from "react"
import { useExpenses, useSettings } from "../hooks"
import { useFilters } from "../filter-store"
import {
  type DerivedExpenseData,
  computeDerivedExpenseData,
} from "./compute-derived-expense-data"

const DerivedExpenseDataContext = createContext<DerivedExpenseData | null>(null)

/**
 * Computes the derived expense data once and shares it via context so every
 * consumer reuses the same result instead of each re-running the single-pass
 * currency grouping and month derivation independently — which produced
 * identical work on every mount for no change in output.
 *
 * Subscribes to the underlying stores, so the derivation re-runs only when the
 * inputs actually change — a single time per store change rather than once per
 * mounted consumer.
 */
export function DerivedExpenseDataProvider({ children }: { children: React.ReactNode }) {
  const { state } = useExpenses()
  const { settings } = useSettings()
  const {
    filters: { selectedCurrency, selectedMonth },
  } = useFilters()

  const value = useMemo(
    () =>
      computeDerivedExpenseData(
        state.activeExpenses,
        settings.defaultCurrency,
        selectedCurrency,
        selectedMonth,
        state.isLoading
      ),
    [
      state.activeExpenses,
      settings.defaultCurrency,
      selectedCurrency,
      selectedMonth,
      state.isLoading,
    ]
  )

  return (
    <DerivedExpenseDataContext.Provider value={value}>
      {children}
    </DerivedExpenseDataContext.Provider>
  )
}

/**
 * Returns the derived expense data computed once by `DerivedExpenseDataProvider`.
 * Throws if no provider is mounted, since a missing provider means the shared
 * derivation was never set up.
 */
export function useDerivedExpenseData(): DerivedExpenseData {
  const context = useContext(DerivedExpenseDataContext)
  if (!context) {
    throw new Error(
      "useDerivedExpenseData must be used within a DerivedExpenseDataProvider."
    )
  }
  return context
}
