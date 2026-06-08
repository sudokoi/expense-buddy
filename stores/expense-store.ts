import { createStore } from "@xstate/store"
import { Expense } from "../types/expense"
import { SyncNotification } from "../services/sync-manager"
import {
  loadAllExpensesFromStorage,
  migrateLegacyExpensesToV1,
  persistExpenseAdded,
  persistExpensesAdded,
  persistExpenseUpdated,
  persistExpensesSnapshot,
  persistExpensesUpdated,
  removeLegacyExpensesKey,
} from "../services/expense-storage"
import { logAsync } from "../services/logger"
import {
  loadDirtyDays,
  markDirtyDay,
  markDeletedDay,
  clearDirtyDays,
} from "../services/expense-dirty-days"
import { enqueueSyncOp } from "../services/sync-queue"
import { isDateEditable, isExpenseEditable } from "../services/read-only-window"
import { getLocalDayKey } from "../utils/date"
import i18next from "i18next"
import { AppSettings } from "../services/settings-manager"
import { syncOrchestrator } from "../services/sync/sync-engine"

function normalizeExpenseForSave(expense: Expense): Expense {
  const normalizedNote = expense.note.trim()
  const normalizedCategory = expense.category.trim()
  const normalizedPaymentMethod = expense.paymentMethod
    ? {
        ...expense.paymentMethod,
        identifier: expense.paymentMethod.identifier?.trim() || undefined,
        instrumentId: expense.paymentMethod.instrumentId?.trim() || undefined,
      }
    : undefined

  return {
    ...expense,
    note: normalizedNote,
    category: normalizedCategory,
    paymentMethod: normalizedPaymentMethod,
  }
}

function addUniqueDay(days: string[], dayKey: string): string[] {
  if (days.includes(dayKey)) return days
  return [...days, dayKey].sort()
}

function addUniqueDays(days: string[], dayKeys: string[]): string[] {
  if (dayKeys.length === 0) return days
  const next = new Set(days)
  for (const dayKey of dayKeys) {
    next.add(dayKey)
  }
  return Array.from(next).sort()
}

// Store event emitter for cross-store communication
type SettingsDownloadedListener = (settings: AppSettings) => void
const settingsDownloadedListeners: SettingsDownloadedListener[] = []

export function onSettingsDownloaded(listener: SettingsDownloadedListener): () => void {
  settingsDownloadedListeners.push(listener)
  return () => {
    const index = settingsDownloadedListeners.indexOf(listener)
    if (index > -1) {
      settingsDownloadedListeners.splice(index, 1)
    }
  }
}

export function emitSettingsDownloaded(settings: AppSettings): void {
  settingsDownloadedListeners.forEach((listener) => listener(settings))
}

// Sync notification event emitter for cross-store communication
type SyncNotificationListener = (notification: SyncNotification) => void
const syncNotificationListeners: SyncNotificationListener[] = []

export function onSyncNotification(listener: SyncNotificationListener): () => void {
  syncNotificationListeners.push(listener)
  return () => {
    const index = syncNotificationListeners.indexOf(listener)
    if (index > -1) {
      syncNotificationListeners.splice(index, 1)
    }
  }
}

function emitSyncNotification(notification: SyncNotification): void {
  syncNotificationListeners.forEach((listener) => listener(notification))
}

/**
 * Emit a read-only block notification when a mutation is rejected because the
 * affected day falls outside the read-only authoring window. Routed through
 * setSyncNotification so it surfaces (and auto-clears) like other sync toasts.
 */
function emitReadOnlyBlockNotification(): void {
  expenseStore.trigger.setSyncNotification({
    notification: {
      localFilesUpdated: 0,
      remoteFilesUpdated: 0,
      message: i18next.t("history.readOnly.blocked"),
    },
  })
}
/**
 * Emit an error notification when an authoring mutation could not be durably
 * persisted. Paired with a rollback event so the in-memory state never stands
 * after its persistence threw. Routed through setSyncNotification so it
 * surfaces (and auto-clears) like other sync toasts.
 */
function emitPersistErrorNotification(): void {
  expenseStore.trigger.setSyncNotification({
    notification: {
      localFilesUpdated: 0,
      remoteFilesUpdated: 0,
      message: i18next.t("history.saveFailed"),
    },
  })
}

/**
 * Seam for post-persistence sync signaling.
 *
 * Authoring effects signal sync only AFTER durable persistence succeeds, and
 * never drive sync as a fire-and-forget chain from inside the mutation effect.
 * This is a thin, idempotent signal: the SyncOrchestrator owns the machine,
 * debounces/coalesces bursts, gates background runs until the active provider is
 * reconciled, and handles every async outcome (Requirements 2.2, 3.5).
 */
function signalSyncAfterPersistence(): void {
  syncOrchestrator.requestSync("on_change")
}

/**
 * In-memory expense store. Authoring mutations enforce the read-only window,
 * await durable persistence (with rollback on failure), and signal the
 * SyncOrchestrator only after persistence succeeds.
 */
export const expenseStore = createStore({
  context: {
    expenses: [] as Expense[],
    isLoading: true,
    syncNotification: null as SyncNotification | null,
    dirtyDays: [] as string[],
    deletedDays: [] as string[],
  },

  on: {
    loadExpenses: (
      context,
      event: { expenses: Expense[]; dirtyDays?: string[]; deletedDays?: string[] }
    ) => ({
      ...context,
      expenses: event.expenses,
      isLoading: false,
      dirtyDays: event.dirtyDays ?? context.dirtyDays,
      deletedDays: event.deletedDays ?? context.deletedDays,
    }),

    setLoading: (context, event: { isLoading: boolean }) => ({
      ...context,
      isLoading: event.isLoading,
    }),

    /**
     * Revert an authoring mutation whose persistence failed. The effect that
     * performed the mutation captures the pre-mutation snapshot and dispatches
     * this event on a persistence throw so an in-memory change never stands
     * without durable backing.
     */
    rollbackMutation: (
      context,
      event: { expenses: Expense[]; dirtyDays: string[]; deletedDays: string[] }
    ) => ({
      ...context,
      expenses: event.expenses,
      dirtyDays: event.dirtyDays,
      deletedDays: event.deletedDays,
    }),

    addExpense: (context, event: { expense: Expense }, enqueue) => {
      const normalizedExpense = normalizeExpenseForSave(event.expense)
      if (!isDateEditable(normalizedExpense.date)) {
        enqueue.effect(() => emitReadOnlyBlockNotification())
        return context // read-only: no mutation, no persist, no enqueue
      }
      const newExpenses = [normalizedExpense, ...context.expenses]
      const dayKey = getLocalDayKey(normalizedExpense.date)
      const dirtyDays = addUniqueDay(context.dirtyDays, dayKey)

      // Snapshot for rollback if persistence throws.
      const previousExpenses = context.expenses
      const previousDirtyDays = context.dirtyDays
      const previousDeletedDays = context.deletedDays

      logAsync(
        "INFO",
        "EXPENSE_STORE",
        `ADD_EXPENSE id=${normalizedExpense.id} amount=${normalizedExpense.amount} currency=${normalizedExpense.currency} category=${normalizedExpense.category}`
      )

      enqueue.effect(async () => {
        try {
          await persistExpenseAdded(normalizedExpense)
          await markDirtyDay(dayKey)
          await enqueueSyncOp({ type: "expense.upsert", expense: normalizedExpense })
          logAsync(
            "INFO",
            "EXPENSE_STORE",
            `ADD_EXPENSE_PERSISTED id=${normalizedExpense.id}`
          )
          // Durable persistence succeeded: signal the orchestrator (after persist).
          signalSyncAfterPersistence()
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `ADD_EXPENSE_PERSIST_FAILED id=${normalizedExpense.id} error=${error}`
          )
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: previousDirtyDays,
            deletedDays: previousDeletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },

    addExpenses: (context, event: { expenses: Expense[] }, enqueue) => {
      const normalizedExpenses = event.expenses.map(normalizeExpenseForSave)
      if (normalizedExpenses.length === 0) {
        return context
      }

      // Reject the whole batch if any entry falls outside the read-only window,
      // consistent with the single-add guard (no mutation, no persist, no enqueue).
      if (normalizedExpenses.some((expense) => !isDateEditable(expense.date))) {
        enqueue.effect(() => emitReadOnlyBlockNotification())
        return context
      }

      const newExpenses = [...normalizedExpenses, ...context.expenses]
      const affectedDays = normalizedExpenses.map((expense) =>
        getLocalDayKey(expense.date)
      )
      const dirtyDays = addUniqueDays(context.dirtyDays, affectedDays)

      // Snapshot for rollback if persistence throws.
      const previousExpenses = context.expenses
      const previousDirtyDays = context.dirtyDays
      const previousDeletedDays = context.deletedDays

      logAsync(
        "INFO",
        "EXPENSE_STORE",
        `BATCH_ADD_EXPENSES count=${normalizedExpenses.length} days=${affectedDays.length}`
      )

      enqueue.effect(async () => {
        try {
          await persistExpensesAdded(normalizedExpenses)

          for (const dayKey of new Set(affectedDays)) {
            await markDirtyDay(dayKey)
          }

          await enqueueSyncOp({
            type: "expense.batchUpsert",
            expenses: normalizedExpenses,
          })

          logAsync(
            "INFO",
            "EXPENSE_STORE",
            `BATCH_ADD_PERSISTED count=${normalizedExpenses.length}`
          )
          // Durable persistence succeeded: signal the orchestrator (after persist).
          signalSyncAfterPersistence()
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `BATCH_ADD_PERSIST_FAILED count=${normalizedExpenses.length} error=${error}`
          )
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: previousDirtyDays,
            deletedDays: previousDeletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },

    editExpense: (context, event: { expense: Expense }, enqueue) => {
      const normalizedExpense = normalizeExpenseForSave(event.expense)
      const existingExpense = context.expenses.find(
        (expense) => expense.id === normalizedExpense.id
      )
      // Block editing an entry already in the read-only zone, and block
      // moving/back-dating an entry to a target date outside the window.
      if (
        (existingExpense && !isExpenseEditable(existingExpense)) ||
        !isDateEditable(normalizedExpense.date)
      ) {
        enqueue.effect(() => emitReadOnlyBlockNotification())
        return context // read-only: no mutation, no persist, no enqueue
      }
      const previousDayKey = existingExpense ? getLocalDayKey(existingExpense.date) : null
      const nextDayKey = getLocalDayKey(normalizedExpense.date)
      const hasOtherOldDayExpenses = previousDayKey
        ? context.expenses.some(
            (expense) =>
              expense.id !== normalizedExpense.id &&
              getLocalDayKey(expense.date) === previousDayKey
          )
        : false
      const deletedDayKey =
        previousDayKey && previousDayKey !== nextDayKey && !hasOtherOldDayExpenses
          ? previousDayKey
          : null
      const newExpenses = context.expenses.map((e) =>
        e.id === normalizedExpense.id ? normalizedExpense : e
      )
      let dirtyDays = addUniqueDay(context.dirtyDays, nextDayKey)
      if (previousDayKey && previousDayKey !== nextDayKey) {
        dirtyDays = addUniqueDay(dirtyDays, previousDayKey)
      }
      let deletedDays = context.deletedDays
      if (deletedDayKey) {
        deletedDays = addUniqueDay(deletedDays, deletedDayKey)
      }

      // Snapshot for rollback if persistence throws.
      const previousExpenses = context.expenses
      const previousDirtyDays = context.dirtyDays
      const previousDeletedDays = context.deletedDays

      const dayChanged = previousDayKey !== nextDayKey
      logAsync(
        "INFO",
        "EXPENSE_STORE",
        `EDIT_EXPENSE id=${normalizedExpense.id} dayChanged=${dayChanged} deletedDayKey=${deletedDayKey ?? "null"}`
      )

      enqueue.effect(async () => {
        try {
          await persistExpenseUpdated(normalizedExpense)
          await markDirtyDay(nextDayKey)
          if (previousDayKey && previousDayKey !== nextDayKey) {
            await markDirtyDay(previousDayKey)
          }
          if (deletedDayKey) {
            await markDeletedDay(deletedDayKey)
          }
          await enqueueSyncOp({ type: "expense.upsert", expense: normalizedExpense })
          logAsync(
            "INFO",
            "EXPENSE_STORE",
            `EDIT_EXPENSE_PERSISTED id=${normalizedExpense.id}`
          )
          // Durable persistence succeeded: signal the orchestrator (after persist).
          signalSyncAfterPersistence()
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `EDIT_EXPENSE_PERSIST_FAILED id=${normalizedExpense.id} error=${error}`
          )
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: previousDirtyDays,
            deletedDays: previousDeletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays, deletedDays }
    },

    deleteExpense: (context, event: { id: string }, enqueue) => {
      const existingExpense = context.expenses.find((e) => e.id === event.id)
      if (existingExpense && !isExpenseEditable(existingExpense)) {
        enqueue.effect(() => emitReadOnlyBlockNotification())
        return context // read-only: no mutation, no persist, no enqueue
      }
      const now = new Date().toISOString()
      // Soft delete: mark with deletedAt timestamp instead of removing
      let updatedExpense: Expense | null = null
      let deletedDayKey: string | null = null
      const newExpenses = context.expenses.map((e) => {
        if (e.id !== event.id) return e
        updatedExpense = { ...e, deletedAt: now, updatedAt: now }
        deletedDayKey = getLocalDayKey(e.date)
        return updatedExpense
      })
      let dirtyDays = context.dirtyDays
      let deletedDays = context.deletedDays
      if (deletedDayKey) {
        dirtyDays = addUniqueDay(dirtyDays, deletedDayKey)
        deletedDays = addUniqueDay(deletedDays, deletedDayKey)
      }

      // Snapshot for rollback if persistence throws.
      const previousExpenses = context.expenses
      const previousDirtyDays = context.dirtyDays
      const previousDeletedDays = context.deletedDays

      logAsync(
        "INFO",
        "EXPENSE_STORE",
        `DELETE_EXPENSE id=${event.id} deletedDayKey=${deletedDayKey ?? "null"}`
      )

      enqueue.effect(async () => {
        try {
          if (updatedExpense) {
            await persistExpenseUpdated(updatedExpense)
          }
          if (deletedDayKey) {
            await markDeletedDay(deletedDayKey)
          }
          if (updatedExpense) {
            await enqueueSyncOp({ type: "expense.upsert", expense: updatedExpense })
          }
          logAsync("INFO", "EXPENSE_STORE", `DELETE_EXPENSE_PERSISTED id=${event.id}`)
          // Durable persistence succeeded: signal the orchestrator (after persist).
          signalSyncAfterPersistence()
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `DELETE_EXPENSE_PERSIST_FAILED id=${event.id} error=${error}`
          )
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: previousDirtyDays,
            deletedDays: previousDeletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays, deletedDays }
    },

    replaceExpenses: (context, event: { expenses: Expense[] }, enqueue) => {
      const previousExpenses = context.expenses

      enqueue.effect(async () => {
        try {
          await persistExpensesSnapshot(event.expenses)
          // Clean up legacy key after a successful full snapshot write.
          await removeLegacyExpensesKey()
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `REPLACE_EXPENSES_PERSIST_FAILED count=${event.expenses.length} error=${error}`
          )
          // Keep in-memory state consistent with durable storage: roll back to
          // the pre-replace set and surface the failure.
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: context.dirtyDays,
            deletedDays: context.deletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return {
        ...context,
        expenses: event.expenses,
      }
    },

    setSyncNotification: (
      context,
      event: { notification: SyncNotification | null },
      enqueue
    ) => {
      if (event.notification) {
        enqueue.effect(() => {
          // Emit event for listeners (store provider will handle routing to notification store)
          emitSyncNotification(event.notification!)

          // Auto-clear after brief delay
          setTimeout(() => {
            expenseStore.trigger.clearSyncNotification()
          }, 500)
        })
      }
      return {
        ...context,
        syncNotification: event.notification,
      }
    },

    clearSyncNotification: (context) => ({
      ...context,
      syncNotification: null,
    }),

    clearDirtyDaysState: (context) => ({
      ...context,
      dirtyDays: [],
      deletedDays: [],
    }),

    clearDirtyDaysAfterSync: (context, _event, enqueue) => {
      enqueue.effect(async () => {
        await clearDirtyDays()
      })
      return {
        ...context,
        dirtyDays: [],
        deletedDays: [],
      }
    },

    reassignExpensesToOther: (context, event: { fromCategory: string }, enqueue) => {
      const now = new Date().toISOString()
      const affectedExpenseIds: string[] = []
      const affectedExpenses: Expense[] = []
      const affectedDays: string[] = []

      // Update all expenses with the deleted category to "Other"
      const newExpenses = context.expenses.map((expense) => {
        if (expense.category === event.fromCategory && !expense.deletedAt) {
          affectedExpenseIds.push(expense.id)
          affectedDays.push(getLocalDayKey(expense.date))
          const updated = {
            ...expense,
            category: "Other",
            updatedAt: now,
          }
          affectedExpenses.push(updated)
          return updated
        }
        return expense
      })

      const dirtyDays = addUniqueDays(context.dirtyDays, affectedDays)

      // Snapshot for rollback if persistence throws.
      const previousExpenses = context.expenses
      const previousDirtyDays = context.dirtyDays
      const previousDeletedDays = context.deletedDays

      enqueue.effect(async () => {
        try {
          // Persist only affected expenses (avoid full-array rewrite)
          if (affectedExpenses.length > 0) {
            await persistExpensesUpdated(affectedExpenses)
          }

          for (const dayKey of new Set(affectedDays)) {
            await markDirtyDay(dayKey)
          }

          if (affectedExpenses.length > 0) {
            await enqueueSyncOp({
              type: "expense.batchUpsert",
              expenses: affectedExpenses,
            })
          }

          // Durable persistence succeeded: signal the orchestrator (after persist).
          if (affectedExpenseIds.length > 0) {
            signalSyncAfterPersistence()
          }
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `REASSIGN_TO_OTHER_PERSIST_FAILED count=${affectedExpenses.length} error=${error}`
          )
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: previousDirtyDays,
            deletedDays: previousDeletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },

    updateExpenseCategories: (
      context,
      event: { fromCategory: string; toCategory: string },
      enqueue
    ) => {
      // Handle same-name rename as no-op
      const fromCategory = event.fromCategory.trim()
      const toCategory = event.toCategory.trim()
      if (fromCategory === toCategory) {
        return context
      }

      const now = new Date().toISOString()
      const affectedExpenseIds: string[] = []
      const affectedExpenses: Expense[] = []
      const affectedDays: string[] = []

      // Update all active expenses with the old category to use the new category
      const newExpenses = context.expenses.map((expense) => {
        if (expense.category === fromCategory && !expense.deletedAt) {
          affectedExpenseIds.push(expense.id)
          affectedDays.push(getLocalDayKey(expense.date))
          const updated = {
            ...expense,
            category: toCategory,
            updatedAt: now,
          }
          affectedExpenses.push(updated)
          return updated
        }
        return expense
      })

      const dirtyDays = addUniqueDays(context.dirtyDays, affectedDays)

      // Snapshot for rollback if persistence throws.
      const previousExpenses = context.expenses
      const previousDirtyDays = context.dirtyDays
      const previousDeletedDays = context.deletedDays

      enqueue.effect(async () => {
        try {
          // Persist only affected expenses (avoid full-array rewrite)
          if (affectedExpenses.length > 0) {
            await persistExpensesUpdated(affectedExpenses)
          }

          for (const dayKey of new Set(affectedDays)) {
            await markDirtyDay(dayKey)
          }

          if (affectedExpenses.length > 0) {
            await enqueueSyncOp({
              type: "expense.batchUpsert",
              expenses: affectedExpenses,
            })
          }

          // Durable persistence succeeded: signal the orchestrator (after persist).
          if (affectedExpenseIds.length > 0) {
            signalSyncAfterPersistence()
          }
        } catch (error) {
          logAsync(
            "ERROR",
            "EXPENSE_STORE",
            `UPDATE_CATEGORIES_PERSIST_FAILED count=${affectedExpenses.length} error=${error}`
          )
          expenseStore.trigger.rollbackMutation({
            expenses: previousExpenses,
            dirtyDays: previousDirtyDays,
            deletedDays: previousDeletedDays,
          })
          emitPersistErrorNotification()
        }
      })

      return { ...context, expenses: newExpenses, dirtyDays }
    },
  },
})

// Exported initialization function - call from React component tree
export async function initializeExpenseStore(
  store: ExpenseStore = expenseStore
): Promise<void> {
  try {
    const loaded = await loadAllExpensesFromStorage()
    const expenses = loaded.expenses

    logAsync(
      "INFO",
      "EXPENSE_STORE",
      `INITIALIZE source=${loaded.source} expenseCount=${expenses.length}`
    )

    // One-time migration: if we loaded from legacy storage, migrate to v1 and remove legacy key.
    if (loaded.source === "legacy") {
      await migrateLegacyExpensesToV1(expenses)
      await removeLegacyExpensesKey()
      logAsync("INFO", "EXPENSE_STORE", "LEGACY_MIGRATION_DONE")
    }

    const dirtyDaysResult = await loadDirtyDays()

    store.trigger.loadExpenses({
      expenses,
      dirtyDays: dirtyDaysResult.state.dirtyDays,
      deletedDays: dirtyDaysResult.state.deletedDays,
    })

    logAsync(
      "INFO",
      "EXPENSE_STORE",
      `LOADED dirtyDays=${dirtyDaysResult.state.dirtyDays?.length ?? 0} deletedDays=${dirtyDaysResult.state.deletedDays?.length ?? 0}`
    )

    // Signal the orchestrator for an app-launch sync. This is a thin background
    // signal: it is a no-op until the active provider has completed its
    // activation-triggered first reconciliation (driven by the StoreProvider via
    // syncOrchestrator.rebindProvider on provider activation).
    syncOrchestrator.requestSync("on_launch")
  } catch (error) {
    logAsync("ERROR", "EXPENSE_STORE", `INITIALIZE_FAILED error=${error}`)
    console.warn("Failed to initialize expense store:", error)
    store.trigger.loadExpenses({ expenses: [] })
  }
}

export type ExpenseStore = typeof expenseStore

/**
 * Filter out soft-deleted expenses for display purposes.
 * Expenses with a deletedAt timestamp are considered deleted and should not be shown to users.
 */
export function getActiveExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((expense) => !expense.deletedAt)
}

/**
 * Check if an expense is soft-deleted
 */
export function isExpenseDeleted(expense: Expense): boolean {
  return !!expense.deletedAt
}
