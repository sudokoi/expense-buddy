import { useEffect, useRef } from "react"
import { useDerivedExpenseData, useExpenses, useSettings } from "../stores/hooks"
import { pushWidgetAssist } from "../services/widget-assist"

/**
 * Fast-path widget freshness: after expenses/settings settle, persist the
 * assist snapshot and broadcast a widget update. Best-effort only — widgets
 * re-derive from live MMKV on every system update regardless (ADR-012).
 */
export function useWidgetAssist() {
  const {
    state: { expenses, isLoading: expensesLoading },
  } = useExpenses()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { effectiveCurrency } = useDerivedExpenseData()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (expensesLoading || settingsLoading) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void pushWidgetAssist(expenses, settings, effectiveCurrency)
    }, 1000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [expenses, settings, effectiveCurrency, expensesLoading, settingsLoading])
}
