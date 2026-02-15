/**
 * Review Queue Store
 *
 * XState store for managing the SMS import review queue
 */

import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ReviewQueueItem } from "../types/sms-import"
import { STORAGE_KEYS } from "../services/sms-import/constants"

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
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const newQueue = context.queue.filter((item) => {
        const itemDate = new Date(item.createdAt)
        return itemDate > thirtyDaysAgo
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
  },
})

/**
 * Initialize the review queue store
 */
export async function initializeReviewQueue(): Promise<void> {
  reviewQueueStore.trigger.setLoading({ isLoading: true })
  const items = await loadReviewQueue()
  reviewQueueStore.trigger.loadQueue({ items })
}
