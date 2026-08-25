import { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useExpenses, useNotifications } from "../stores/hooks"
import { downloadExpensesToCsv } from "../services/csv-export"

export interface UseExportActionReturn {
  handleExport: () => Promise<void>
  isExporting: boolean
}

/**
 * Screen-facing hook for CSV export (ADR-011).
 * Keeps Route → Hook → Service layering: screens call this hook,
 * the hook invokes service-layer file I/O + SAF/share and surfaces
 * notifications. Direct `services/csv-export` import from routes is
 * intentionally avoided.
 */
export function useExportAction(): UseExportActionReturn {
  const { t } = useTranslation()
  const { state } = useExpenses()
  const { addNotification } = useNotifications()
  const [isExporting, setIsExporting] = useState(false)
  const isExportingRef = useRef(false)

  const handleExport = useCallback(async () => {
    if (isExportingRef.current) return
    isExportingRef.current = true
    setIsExporting(true)
    try {
      // Direct save to Downloads (SAF) / Documents (iOS); downloadExpensesToCsv
      // already falls back to share sheet if SAF is unavailable.
      const result = await downloadExpensesToCsv(state.expenses)

      if (result.success && result.uri) {
        addNotification(t("settings.general.exportSuccess"), "success")
        return
      }

      if (result.cancelled) {
        addNotification(t("settings.general.exportCancelled"), "info")
        return
      }

      addNotification(t("settings.general.exportError"), "error")
    } finally {
      isExportingRef.current = false
      setIsExporting(false)
    }
  }, [state.expenses, addNotification, t])

  return { handleExport, isExporting }
}
