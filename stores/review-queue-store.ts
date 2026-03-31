/**
 * Review Queue Store
 *
 * XState store for managing the SMS import review queue.
 * Handles confirm, edit, reject actions for individual and bulk items.
 */

import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ReviewQueueItem } from "../types/sms-import"
import { Expense, PaymentMethodType } from "../types/expense"
import { PaymentInstrument } from "../types/payment-instrument"
import { STORAGE_KEYS } from "../services/sms-import/constants"
import { RETENTION_LIMITS } from "../services/sms-import/constants"
import { expenseStore } from "./expense-store"
import { merchantLearningEngine } from "../services/sms-import/learning-engine"
import { duplicateDetector } from "../services/sms-import/duplicate-detector"
import { generateId } from "../utils/id"

interface ReviewQueueContext {
  queue: ReviewQueueItem[]
  isLoading: boolean
  currentItem: ReviewQueueItem | null
  stats: {
    totalImported: number
    pendingReview: number
  }
}

/**
 * Build an expense from a review queue item with optional user overrides
 */
function buildExpenseFromItem(
  item: ReviewQueueItem,
  overrides?: {
    category?: string
    paymentMethod?: PaymentMethodType
    instrument?: PaymentInstrument
    note?: string
    amount?: number
    userCorrected?: boolean
  }
): Expense {
  const parsed = item.parsedTransaction
  const reviewedAt = new Date().toISOString()
  const now = new Date().toISOString()

  return {
    id: generateId(),
    amount: overrides?.amount ?? parsed.amount,
    currency: parsed.currency,
    category: overrides?.category ?? item.suggestedCategory,
    date: parsed.date,
    note: overrides?.note ?? parsed.merchant,
    paymentMethod: {
      type: overrides?.paymentMethod ?? item.suggestedPaymentMethod,
      instrumentId: overrides?.instrument?.id ?? item.suggestedInstrument?.id,
    },
    createdAt: now,
    updatedAt: now,
    source: "auto-imported",
    importMetadata: {
      ...parsed.metadata,
      reviewedAt,
      userCorrected: overrides?.userCorrected ?? false,
    },
  }
}

/**
 * Run the confirm side effects for a single item
 */
async function runConfirmEffect(item: ReviewQueueItem, expense: Expense): Promise<void> {
  expenseStore.trigger.addExpense({ expense, triggerSync: false })
  await merchantLearningEngine.learnFromExpense(expense, item.parsedTransaction)
  await duplicateDetector.markProcessed(item.parsedTransaction.metadata.messageId)
}

/**
 * Run the edit side effects for a single item
 */
async function runEditEffect(
  item: ReviewQueueItem,
  expense: Expense,
  overrides: {
    category: string
    paymentMethod: PaymentMethodType
    instrument?: PaymentInstrument
    note: string
    amount: number
    applyToFuture: boolean
  }
): Promise<void> {
  expenseStore.trigger.addExpense({ expense, triggerSync: false })

  if (overrides.applyToFuture) {
    const correction = {
      id: generateId(),
      originalMerchant: item.parsedTransaction.merchant,
      correctedCategory: overrides.category,
      correctedPaymentMethod: overrides.paymentMethod,
      correctedInstrument: overrides.instrument,
      timestamp: new Date().toISOString(),
      applyToFuture: true,
    }
    await merchantLearningEngine.addCorrection(correction)
  }
  await merchantLearningEngine.learnFromExpense(expense, item.parsedTransaction)
  await duplicateDetector.markProcessed(item.parsedTransaction.metadata.messageId)
}

/**
 * Run the reject side effects for a single item
 */
async function runRejectEffect(item: ReviewQueueItem): Promise<void> {
  await duplicateDetector.markProcessed(item.parsedTransaction.metadata.messageId)
}

/**
 * Save review queue to storage
 */
async function saveReviewQueue(queue: ReviewQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_QUEUE, JSON.stringify(queue))
  } catch (error) {
    console.error("Failed to save review queue:", error)
  }
}

/**
 * Load review queue from storage
 */
async function loadReviewQueue(): Promise<ReviewQueueItem[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_QUEUE)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error("Failed to load review queue:", error)
  }
  return []
}

/**
 * Remove item from review queue storage
 */
async function removeFromReviewQueue(itemId: string): Promise<void> {
  try {
    const queue = await loadReviewQueue()
    const filtered = queue.filter((item) => item.id !== itemId)
    await saveReviewQueue(filtered)
  } catch (error) {
    console.error("Failed to remove from review queue:", error)
  }
}

/**
 * Compute queue stats
 */
function computeStats(queue: ReviewQueueItem[]) {
  return {
    totalImported: queue.length,
    pendingReview: queue.filter((i) => i.status === "pending").length,
  }
}

export const reviewQueueStore = createStore({
  context: {
    queue: [] as ReviewQueueItem[],
    isLoading: true,
    currentItem: null as ReviewQueueItem | null,
    stats: {
      totalImported: 0,
      pendingReview: 0,
    },
  } as ReviewQueueContext,

  on: {
    loadQueue: (context, event: { items: ReviewQueueItem[] }) => ({
      ...context,
      queue: event.items,
      isLoading: false,
      stats: computeStats(event.items),
    }),

    addItem: (context, event: { item: ReviewQueueItem }, enqueue) => {
      const newQueue = [...context.queue, event.item]

      enqueue.effect(async () => {
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        stats: computeStats(newQueue),
      }
    },

    removeItem: (context, event: { itemId: string }, enqueue) => {
      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      enqueue.effect(async () => {
        await removeFromReviewQueue(event.itemId)
      })

      return {
        ...context,
        queue: newQueue,
        currentItem:
          context.currentItem?.id === event.itemId ? null : context.currentItem,
        stats: computeStats(newQueue),
      }
    },

    setCurrentItem: (context, event: { itemId: string | null }) => ({
      ...context,
      currentItem: event.itemId
        ? context.queue.find((i) => i.id === event.itemId) || null
        : null,
    }),

    clearOldItems: (context, _event, enqueue) => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - RETENTION_LIMITS.REVIEW_QUEUE_DAYS)

      const newQueue = context.queue.filter((item) => {
        const itemDate = new Date(item.createdAt)
        return itemDate > cutoff
      })

      enqueue.effect(async () => {
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        stats: computeStats(newQueue),
      }
    },

    setLoading: (context, event: { isLoading: boolean }) => ({
      ...context,
      isLoading: event.isLoading,
    }),

    confirmItem: (
      context,
      event: { itemId: string; applyToFuture: boolean },
      enqueue
    ) => {
      const item = context.queue.find((i) => i.id === event.itemId)
      if (!item) return context

      const expense = buildExpenseFromItem(item)
      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      enqueue.effect(async () => {
        await runConfirmEffect(item, expense)
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        currentItem:
          context.currentItem?.id === event.itemId ? null : context.currentItem,
        stats: computeStats(newQueue),
      }
    },

    editItem: (
      context,
      event: {
        itemId: string
        category: string
        paymentMethod: PaymentMethodType
        instrument?: PaymentInstrument
        note: string
        amount: number
        applyToFuture: boolean
      },
      enqueue
    ) => {
      const item = context.queue.find((i) => i.id === event.itemId)
      if (!item) return context

      const expense = buildExpenseFromItem(item, {
        category: event.category,
        paymentMethod: event.paymentMethod,
        instrument: event.instrument,
        note: event.note,
        amount: event.amount,
        userCorrected: true,
      })
      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      enqueue.effect(async () => {
        await runEditEffect(item, expense, {
          category: event.category,
          paymentMethod: event.paymentMethod,
          instrument: event.instrument,
          note: event.note,
          amount: event.amount,
          applyToFuture: event.applyToFuture,
        })
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        currentItem:
          context.currentItem?.id === event.itemId ? null : context.currentItem,
        stats: computeStats(newQueue),
      }
    },

    rejectItem: (context, event: { itemId: string }, enqueue) => {
      const item = context.queue.find((i) => i.id === event.itemId)
      if (!item) return context

      const newQueue = context.queue.filter((i) => i.id !== event.itemId)

      enqueue.effect(async () => {
        await runRejectEffect(item)
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        currentItem:
          context.currentItem?.id === event.itemId ? null : context.currentItem,
        stats: computeStats(newQueue),
      }
    },

    confirmAll: (context, _event, enqueue) => {
      const pendingItems = context.queue.filter((i) => i.status === "pending")
      if (pendingItems.length === 0) return context

      const expenses = pendingItems.map((item) => buildExpenseFromItem(item))
      const pendingIds = new Set(pendingItems.map((i) => i.id))
      const newQueue = context.queue.filter((i) => !pendingIds.has(i.id))

      enqueue.effect(async () => {
        for (let idx = 0; idx < pendingItems.length; idx++) {
          await runConfirmEffect(pendingItems[idx], expenses[idx])
        }
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        currentItem:
          context.currentItem && pendingIds.has(context.currentItem.id)
            ? null
            : context.currentItem,
        stats: computeStats(newQueue),
      }
    },

    rejectAll: (context, _event, enqueue) => {
      const pendingItems = context.queue.filter((i) => i.status === "pending")
      if (pendingItems.length === 0) return context

      const pendingIds = new Set(pendingItems.map((i) => i.id))
      const newQueue = context.queue.filter((i) => !pendingIds.has(i.id))

      enqueue.effect(async () => {
        for (const item of pendingItems) {
          await runRejectEffect(item)
        }
        await saveReviewQueue(newQueue)
      })

      return {
        ...context,
        queue: newQueue,
        currentItem:
          context.currentItem && pendingIds.has(context.currentItem.id)
            ? null
            : context.currentItem,
        stats: computeStats(newQueue),
      }
    },
  },
})

/**
 * Initialize the review queue store
 */
export async function initializeReviewQueue(): Promise<void> {
  reviewQueueStore.trigger.setLoading({ isLoading: true })
  const items = await loadReviewQueue()
  reviewQueueStore.trigger.loadQueue({ items })
  reviewQueueStore.trigger.clearOldItems()
}
