import { Expense } from "../../types/expense"

/**
 * Group expenses by currency (single pass).
 * @returns Map of currency code -> expenses array.
 */
export function groupExpensesByCurrency(
  expenses: Expense[],
  defaultCurrency: string = "INR"
): Map<string, Expense[]> {
  const groups = new Map<string, Expense[]>()
  for (const expense of expenses) {
    // Fallback to defaultCurrency if expense.currency is undefined
    const currency = expense.currency || defaultCurrency
    if (!groups.has(currency)) {
      groups.set(currency, [])
    }
    groups.get(currency)!.push(expense)
  }
  return groups
}
