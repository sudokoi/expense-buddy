import AsyncStorage from "@react-native-async-storage/async-storage"
import { Expense } from "../types/expense"
import {
  loadSettings,
  saveSettings,
  markSettingsChanged,
  AppSettings,
} from "./settings-manager"
import {
  createMigrationNickname,
  findActiveInstrumentByMethodAndLastDigits,
  generatePaymentInstrumentId,
  getLastDigitsLength,
  isPaymentInstrumentMethod,
  sanitizeLastDigits,
} from "./payment-instruments"
import { PaymentInstrument, PaymentInstrumentMethod } from "../types/payment-instrument"
import { trackBulkEdit } from "./change-tracker"

const EXPENSES_KEY = "expenses"

function shouldConsiderForInstrument(method: PaymentInstrumentMethod): boolean {
  return method === "Credit Card" || method === "Debit Card" || method === "UPI"
}

function coerceLastDigits(
  method: PaymentInstrumentMethod,
  identifier: string
): string | null {
  const expectedLen = getLastDigitsLength(method)
  const digitsOnly = sanitizeLastDigits(identifier, expectedLen)
  if (digitsOnly.length !== expectedLen) return null
  return digitsOnly
}

function attachInstrumentIds(
  expenses: Expense[],
  instruments: PaymentInstrument[]
): { updated: Expense[]; editedIds: string[] } {
  const editedIds: string[] = []

  const updated = expenses.map((expense) => {
    const paymentMethod = expense.paymentMethod
    if (!paymentMethod) return expense

    if (!isPaymentInstrumentMethod(paymentMethod.type)) return expense
    if (!shouldConsiderForInstrument(paymentMethod.type)) return expense

    if (paymentMethod.instrumentId) return expense
    if (!paymentMethod.identifier) return expense

    const lastDigits = coerceLastDigits(paymentMethod.type, paymentMethod.identifier)
    if (!lastDigits) return expense

    const match = findActiveInstrumentByMethodAndLastDigits(
      instruments,
      paymentMethod.type,
      lastDigits
    )

    if (!match) return expense

    editedIds.push(expense.id)
    return {
      ...expense,
      paymentMethod: {
        ...paymentMethod,
        identifier: lastDigits,
        instrumentId: match.id,
      },
      updatedAt: new Date().toISOString(),
    }
  })

  return { updated, editedIds }
}

export async function migratePaymentInstrumentsOnStartup(): Promise<void> {
  const settings = await loadSettings()

  const stored = await AsyncStorage.getItem(EXPENSES_KEY)
  const expenses: Expense[] = stored ? JSON.parse(stored) : []

  // Ensure paymentInstruments exists even if settings were partially migrated
  let nextSettings: AppSettings = {
    ...settings,
    paymentInstruments: settings.paymentInstruments ?? [],
    paymentInstrumentsMigrationVersion: settings.paymentInstrumentsMigrationVersion ?? 0,
  }

  let nextExpenses = expenses
  const editedExpenseIds: string[] = []

  const needsInitialMigration = nextSettings.paymentInstrumentsMigrationVersion < 1

  if (needsInitialMigration) {
    const now = new Date().toISOString()

    const instruments: PaymentInstrument[] = [...nextSettings.paymentInstruments]

    // Create instruments from existing expenses
    for (const expense of expenses) {
      const paymentMethod = expense.paymentMethod
      if (!paymentMethod) continue
      if (!isPaymentInstrumentMethod(paymentMethod.type)) continue
      if (!shouldConsiderForInstrument(paymentMethod.type)) continue
      if (paymentMethod.instrumentId) continue
      if (!paymentMethod.identifier) continue

      const lastDigits = coerceLastDigits(paymentMethod.type, paymentMethod.identifier)
      if (!lastDigits) continue

      const existing = findActiveInstrumentByMethodAndLastDigits(
        instruments,
        paymentMethod.type,
        lastDigits
      )

      if (existing) {
        continue
      }

      const nickname = createMigrationNickname(
        paymentMethod.type,
        lastDigits,
        instruments
      )

      instruments.push({
        id: generatePaymentInstrumentId(),
        method: paymentMethod.type,
        nickname,
        lastDigits,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Link expenses to newly created instruments
    const { updated, editedIds } = attachInstrumentIds(expenses, instruments)
    nextExpenses = updated
    editedExpenseIds.push(...editedIds)

    nextSettings = {
      ...nextSettings,
      paymentInstruments: instruments,
      paymentInstrumentsMigrationVersion: 1,
      version: Math.max(nextSettings.version ?? 0, 5),
    }

    // Persist migration changes
    await Promise.all([
      AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(nextExpenses)),
      saveSettings(nextSettings),
      trackBulkEdit(editedExpenseIds),
      nextSettings.syncSettings ? markSettingsChanged() : Promise.resolve(),
    ])

    return
  }

  // If already migrated, do a lightweight relink pass (e.g., for newly imported expenses)
  if (nextSettings.paymentInstruments.length > 0 && expenses.length > 0) {
    const { updated, editedIds } = attachInstrumentIds(
      expenses,
      nextSettings.paymentInstruments
    )

    if (editedIds.length > 0) {
      await Promise.all([
        AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(updated)),
        trackBulkEdit(editedIds),
      ])
    }
  }
}
