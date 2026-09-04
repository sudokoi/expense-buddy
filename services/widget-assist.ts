import i18next from "i18next"
import type { Expense } from "../types/expense"
import type { AppSettings } from "./settings-manager"

/**
 * Assist-hints builder for Android widgets (ADR-012).
 * Pure derivation lives here so it stays unit-testable; the native
 * `persistAssist` write + `refreshWidgets` broadcast are best-effort.
 *
 * Localized display strings are captured from `translation.json` at compute
 * time so it stays the single source of widget copy; `%d`/`%s` placeholders
 * are formatted natively at render time.
 */
export interface WidgetAssistCopy {
  today: string
  last7Days: string
  recent: string
  empty: string
  expensesOne: string
  expensesMany: string
  thisMonth: string
  other: string
  configTitle: string
  configCategory: string
  configAll: string
  configHide: string
  configSave: string
}

export interface WidgetAssistPayload {
  dataVersion: string
  currency: string
  categoryColors: Record<string, string>
  copy: WidgetAssistCopy
}

export function widgetAssistCopy(): WidgetAssistCopy {
  const t = i18next.t.bind(i18next)
  return {
    today: t("widget.today"),
    last7Days: t("widget.last7Days"),
    recent: t("widget.recent"),
    empty: t("history.emptyTitle"),
    expensesOne: t("widget.expensesOne"),
    expensesMany: t("widget.expensesMany").replace("{{count}}", "%d"),
    thisMonth: t("widget.thisMonth").replace("{{total}}", "%s"),
    other: t("settings.categories.other"),
    configTitle: t("widget.configTitle"),
    configCategory: t("add.fields.category"),
    configAll: t("widget.configAll"),
    configHide: t("widget.configHide"),
    configSave: t("widget.configSave"),
  }
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
    copy: widgetAssistCopy(),
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
