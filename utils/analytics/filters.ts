import { Expense, PaymentMethodType } from "../../types/expense"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../../types/payment-instrument"
import {
  isPaymentInstrumentMethod,
  findInstrumentById,
} from "../../services/payment-instruments"

export type PaymentInstrumentSelectionKey = string

export type PaymentMethodSelectionKey = PaymentMethodType | "__none__"

const PAYMENT_METHOD_NONE_KEY: PaymentMethodSelectionKey = "__none__"

const INSTRUMENT_OTHERS_ID = "__others__"

export function makePaymentInstrumentSelectionKey(
  method: PaymentInstrumentMethod,
  instrumentId?: string
): PaymentInstrumentSelectionKey {
  return `${method}::${instrumentId ?? INSTRUMENT_OTHERS_ID}`
}

function resolveInstrumentKeyForExpense(
  expense: Expense,
  instruments: PaymentInstrument[]
): {
  method: PaymentInstrumentMethod
  key: PaymentInstrumentSelectionKey
  isOther: boolean
  instrumentId?: string
} | null {
  const method = expense.paymentMethod?.type
  if (!method || !isPaymentInstrumentMethod(method)) return null

  const instrumentId = expense.paymentMethod?.instrumentId
  const inst = findInstrumentById(instruments, instrumentId)
  if (!inst || inst.deletedAt) {
    return {
      method,
      key: makePaymentInstrumentSelectionKey(method, undefined),
      isOther: true,
      instrumentId: undefined,
    }
  }
  return {
    method,
    key: makePaymentInstrumentSelectionKey(method, inst.id),
    isOther: false,
    instrumentId: inst.id,
  }
}

/**
 * Filter expenses by selected payment instrument keys.
 * If selection is empty, returns all expenses.
 * When selection is non-empty, includes ONLY expenses whose payment method is an instrument method
 * and whose resolved instrument key matches.
 */
export function filterExpensesByPaymentInstruments(
  expenses: Expense[],
  selectedInstrumentKeys: PaymentInstrumentSelectionKey[],
  instruments: PaymentInstrument[]
): Expense[] {
  if (selectedInstrumentKeys.length === 0) return expenses

  const selection = new Set(selectedInstrumentKeys)
  return expenses.filter((expense) => {
    const resolved = resolveInstrumentKeyForExpense(expense, instruments)
    if (!resolved) return false
    return selection.has(resolved.key)
  })
}

/**
 * Filter expenses by selected categories
 */
export function filterExpensesByCategories(
  expenses: Expense[],
  selectedCategories: string[]
): Expense[] {
  if (selectedCategories.length === 0) {
    return expenses
  }

  const selection = new Set(selectedCategories)
  return expenses.filter((expense) => selection.has(expense.category))
}

/**
 * Filter expenses by selected payment methods.
 * Empty selection means "All".
 * Supports a "__none__" key to include expenses without a payment method.
 */
export function filterExpensesByPaymentMethods(
  expenses: Expense[],
  selected: PaymentMethodSelectionKey[]
): Expense[] {
  if (selected.length === 0) return expenses

  const selection = new Set(selected)

  return expenses.filter((expense) => {
    const method = expense.paymentMethod?.type
    // Note: analytics aggregates missing payment methods under "Other".
    // So selecting "Other" should include both explicit "Other" and missing-method expenses.
    if (!method) return selection.has(PAYMENT_METHOD_NONE_KEY) || selection.has("Other")
    return selection.has(method)
  })
}
