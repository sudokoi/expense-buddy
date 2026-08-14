import type { TFunction } from "i18next"
import type { PaymentMethodType } from "../../types/expense"
import type { PaymentInstrument } from "../../types/payment-instrument"
import type {
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "./filters"
import {
  PAYMENT_INSTRUMENT_METHODS,
  findInstrumentById,
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import { getPaymentMethodI18nKey } from "../../constants/payment-methods"

/**
 * Single source of truth for the "applied filters" summary and payment
 * instrument selection rules shared by the Analytics tab, History tab, and the
 * Filters screen. Every label-formatting rule lives here so a change to how a
 * filter is summarised lands in one place instead of three.
 */

const INSTRUMENT_OTHERS_ID = "__others__"

export function methodShortLabel(method: string): string {
  switch (method) {
    case "Credit Card":
      return "CC"
    case "Debit Card":
      return "DC"
    case "UPI":
      return "UPI"
    default:
      return method
  }
}

/**
 * Collapse a list of selected values into a compact summary like
 * `A, B, C` or `A, B, +3`, capped at three visible items.
 */
export function formatListBreakdown(items: string[], allLabel: string): string {
  const MAX_ITEMS = 3

  const unique = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b))
  const visible = unique.slice(0, MAX_ITEMS)
  const remaining = unique.length - visible.length

  if (unique.length === 0) return allLabel
  if (unique.length === 1) return visible[0]

  return remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")
}

export function paymentMethodLabel(
  key: PaymentMethodSelectionKey,
  t: TFunction
): string {
  if (key === "__none__") return t("analytics.chart.none")
  return t(`paymentMethods.${getPaymentMethodI18nKey(key as PaymentMethodType)}`)
}

export function formatSelectedPaymentInstrumentLabel(
  key: PaymentInstrumentSelectionKey,
  instruments: PaymentInstrument[],
  t: TFunction
): string {
  const [method, instrumentId] = key.split("::")
  const shortMethod = methodShortLabel(method)

  if (!instrumentId || instrumentId === INSTRUMENT_OTHERS_ID) {
    return `${shortMethod} • ${t("analytics.chart.others")}`
  }

  const inst = findInstrumentById(instruments, instrumentId)
  if (!inst || inst.deletedAt) {
    return `${shortMethod} • ${t("analytics.chart.others")}`
  }

  return `${shortMethod} • ${formatPaymentInstrumentLabel(inst)}`
}

export function formatSelectedPaymentInstrumentsSummary(
  keys: PaymentInstrumentSelectionKey[],
  t: TFunction
): string {
  if (keys.length === 0) return t("analytics.timeWindow.all")
  if (keys.length === 1) return "1"

  const countsByMethod = new Map<string, number>()
  for (const key of keys) {
    const [method] = key.split("::")
    const short = methodShortLabel(method)
    countsByMethod.set(short, (countsByMethod.get(short) ?? 0) + 1)
  }

  const parts = Array.from(countsByMethod.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([method, count]) => `${method} ${count}`)

  const MAX_GROUPS = 3
  const visible = parts.slice(0, MAX_GROUPS)
  const remaining = parts.length - visible.length
  const breakdown =
    remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")

  return `${keys.length} (${breakdown})`
}

/**
 * Whether the payment-instrument filter is relevant given the active instruments
 * and the currently selected payment methods. Empty method selection means "All".
 */
export function showPaymentInstrumentFilter(
  instruments: PaymentInstrument[],
  selectedPaymentMethods: PaymentMethodSelectionKey[]
): boolean {
  const active = getActivePaymentInstruments(instruments)
  const allowedMethods =
    selectedPaymentMethods.length === 0
      ? new Set(PAYMENT_INSTRUMENT_METHODS)
      : new Set(
          PAYMENT_INSTRUMENT_METHODS.filter((m) =>
            selectedPaymentMethods.includes(m as PaymentMethodSelectionKey)
          )
        )

  for (const method of PAYMENT_INSTRUMENT_METHODS) {
    if (!allowedMethods.has(method)) continue
    if (active.some((i) => i.method === method)) return true
  }
  return false
}

/**
 * Drop instrument selections that are no longer valid for the chosen payment
 * methods. Empty method selection means "All" methods.
 */
export function prunePaymentInstrumentSelection(
  nextSelectedPaymentMethods: PaymentMethodSelectionKey[],
  currentInstrumentSelection: PaymentInstrumentSelectionKey[],
  instruments: PaymentInstrument[]
): PaymentInstrumentSelectionKey[] {
  if (currentInstrumentSelection.length === 0) return currentInstrumentSelection

  const active = getActivePaymentInstruments(instruments)
  const allowedMethods =
    nextSelectedPaymentMethods.length === 0
      ? new Set(PAYMENT_INSTRUMENT_METHODS)
      : new Set(
          PAYMENT_INSTRUMENT_METHODS.filter((m) =>
            nextSelectedPaymentMethods.includes(m as PaymentMethodSelectionKey)
          )
        )

  const allowedWithConfig = new Set<string>()
  for (const method of allowedMethods) {
    if (active.some((i) => i.method === method)) {
      allowedWithConfig.add(method)
    }
  }

  return currentInstrumentSelection.filter((key) => {
    const method = key.split("::")[0]
    return allowedWithConfig.has(method)
  })
}
