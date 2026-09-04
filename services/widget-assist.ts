import type { Expense } from "../types/expense"
import type { AppSettings } from "./settings-manager"

/**
 * Assist-hints builder for Android widgets (ADR-012).
 * Pure derivation lives here so it stays unit-testable; the native
 * `persistAssist` write + `refreshWidgets` broadcast are best-effort.
 */
export interface WidgetAssistPayload {
  dataVersion: string
  currency: string
  categoryColors: Record<string, string>
}

export function buildWidgetAssist(
  expenses: Expense[],
  settings: AppSettings,
  effectiveCurrency?: string
): WidgetAssistPayload {
  let dataVersion = ""
  for (const expense of expenses) {
    if (!expense.deletedAt && expense.updatedAt > dataVersion) {
      dataVersion = expense.updatedAt
    }
  }
  const categoryColors: Record<string, string> = {}
  for (const category of settings.categories ?? []) {
    categoryColors[category.label] = category.color
  }
  return {
    dataVersion,
    currency: effectiveCurrency ?? settings.defaultCurrency ?? "INR",
    categoryColors,
  }
}

export async function pushWidgetAssist(
  expenses: Expense[],
  settings: AppSettings,
  effectiveCurrency?: string
): Promise<void> {
  try {
    const { default: WidgetModule } = await import("../modules/expense-buddy-widget")
    if (!WidgetModule) return
    await WidgetModule.persistAssist(
      JSON.stringify(buildWidgetAssist(expenses, settings, effectiveCurrency))
    )
    await WidgetModule.refreshWidgets()
  } catch {
    // Best-effort: widgets re-derive from live MMKV on next system update.
  }
}
