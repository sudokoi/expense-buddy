import AsyncStorage from "@react-native-async-storage/async-storage"
import type { Expense } from "../types/expense"

export const LEGACY_EXPENSES_KEY = "expenses"

const EXPENSES_INDEX_KEY_V1 = "expenses:index:v1"
const EXPENSE_ITEM_PREFIX_V1 = "expenses:item:v1:"

function expenseItemKeyV1(id: string): string {
  return `${EXPENSE_ITEM_PREFIX_V1}${id}`
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

async function loadExpenseIdsV1(): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(EXPENSES_INDEX_KEY_V1)
  const parsed = safeJsonParse<unknown>(raw)
  if (!Array.isArray(parsed)) return null
  return parsed.filter((v) => typeof v === "string") as string[]
}

async function saveExpenseIdsV1(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(EXPENSES_INDEX_KEY_V1, JSON.stringify(ids))
}

async function loadExpensesV1(): Promise<Expense[] | null> {
  const ids = await loadExpenseIdsV1()
  if (!ids) return null
  if (ids.length === 0) return []

  const expenses: Expense[] = []
  const existingIds: string[] = []

  for (const id of ids) {
    const raw = await AsyncStorage.getItem(expenseItemKeyV1(id))
    const parsed = safeJsonParse<Expense>(raw)
    if (parsed && typeof parsed.id === "string") {
      expenses.push(parsed)
      existingIds.push(id)
    }
  }

  // If some items are missing/corrupt, heal the index.
  if (existingIds.length !== ids.length) {
    await saveExpenseIdsV1(existingIds)
  }

  return expenses
}

async function loadLegacyExpenses(): Promise<Expense[] | null> {
  const raw = await AsyncStorage.getItem(LEGACY_EXPENSES_KEY)
  const parsed = safeJsonParse<unknown>(raw)
  if (!parsed) return []
  if (!Array.isArray(parsed)) return []
  return parsed as Expense[]
}

export type ExpenseStorageSource = "v1" | "legacy" | "empty"

export async function loadAllExpensesFromStorage(): Promise<{
  expenses: Expense[]
  source: ExpenseStorageSource
}> {
  const v1 = await loadExpensesV1()
  if (v1 !== null) {
    return { expenses: v1, source: "v1" }
  }

  const legacy = await loadLegacyExpenses()
  if (legacy && legacy.length > 0) {
    return { expenses: legacy, source: "legacy" }
  }

  return { expenses: legacy ?? [], source: "empty" }
}

export async function migrateLegacyExpensesToV1(expenses: Expense[]): Promise<void> {
  const ids = expenses.map((e) => e.id)

  await saveExpenseIdsV1(ids)
  for (const expense of expenses) {
    await AsyncStorage.setItem(expenseItemKeyV1(expense.id), JSON.stringify(expense))
  }

  // Keep legacy for now; callers can remove when safe.
}

export async function removeLegacyExpensesKey(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_EXPENSES_KEY)
}

export async function persistExpenseAdded(expense: Expense): Promise<void> {
  // Write item first (so a crash leaves index pointing to missing item rather than vice versa).
  await AsyncStorage.setItem(expenseItemKeyV1(expense.id), JSON.stringify(expense))

  const ids = (await loadExpenseIdsV1()) ?? []
  const nextIds = ids.includes(expense.id) ? ids : [expense.id, ...ids]
  await saveExpenseIdsV1(nextIds)
}

export async function persistExpenseUpdated(expense: Expense): Promise<void> {
  await AsyncStorage.setItem(expenseItemKeyV1(expense.id), JSON.stringify(expense))

  const ids = (await loadExpenseIdsV1()) ?? []
  if (!ids.includes(expense.id)) {
    await saveExpenseIdsV1([...ids, expense.id])
  }
}

export async function persistExpensesUpdated(expenses: Expense[]): Promise<void> {
  for (const expense of expenses) {
    await persistExpenseUpdated(expense)
  }
}

export async function persistExpensesSnapshot(expenses: Expense[]): Promise<void> {
  const nextIds = expenses.map((e) => e.id)

  const previousIds = (await loadExpenseIdsV1()) ?? []
  const nextIdSet = new Set(nextIds)
  const removedIds = previousIds.filter((id) => !nextIdSet.has(id))

  await saveExpenseIdsV1(nextIds)

  for (const expense of expenses) {
    await AsyncStorage.setItem(expenseItemKeyV1(expense.id), JSON.stringify(expense))
  }

  for (const id of removedIds) {
    await AsyncStorage.removeItem(expenseItemKeyV1(id))
  }
}
