import { Expense } from "../types/expense"
import { Category } from "../types/category"
import { AppSettings } from "../services/settings-manager"

/**
 * Test utility for creating mock expenses
 */
export function createMockExpense(overrides?: Partial<Expense>): Expense {
  const now = new Date().toISOString()
  return {
    id: "test-expense-1",
    amount: 100,
    category: "Food",
    date: now,
    note: "Test expense",
    currency: "USD",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Test utility for creating multiple mock expenses
 */
export function createMockExpenses(
  count: number,
  overrides?: Partial<Expense>
): Expense[] {
  return Array.from({ length: count }, (_, i) =>
    createMockExpense({
      id: `test-expense-${i + 1}`,
      ...overrides,
    })
  )
}

/**
 * Test utility for creating mock categories
 */
export function createMockCategory(overrides?: Partial<Category>): Category {
  const now = new Date().toISOString()
  return {
    label: "Test Category",
    color: "#FF0000",
    icon: "utensils",
    order: 0,
    isDefault: false,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Test utility for creating mock settings
 */
export function createMockSettings(overrides?: Partial<AppSettings>): AppSettings {
  const now = new Date().toISOString()
  return {
    theme: "system",
    language: "en-IN",
    defaultCurrency: "USD",
    syncSettings: false,
    autoSyncEnabled: false,
    autoSyncTiming: "on_change",
    categories: [],
    categoriesVersion: 1,
    paymentInstruments: [],
    paymentInstrumentsMigrationVersion: 0,
    updatedAt: now,
    version: 1,
    ...overrides,
  }
}
