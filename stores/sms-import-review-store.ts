import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { SmsImportReviewItem, SmsImportReviewQueueSnapshot } from "../types/sms-import"

const SMS_IMPORT_REVIEW_QUEUE_KEY = "sms_import_review_queue_state_v1"

function sortReviewItems(items: SmsImportReviewItem[]): SmsImportReviewItem[] {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.sourceMessage.receivedAt).getTime()
    const rightTime = new Date(right.sourceMessage.receivedAt).getTime()
    return rightTime - leftTime
  })
}

function mergeReviewItems(
  existingItems: SmsImportReviewItem[],
  nextItems: SmsImportReviewItem[]
): SmsImportReviewItem[] {
  const byId = new Map(existingItems.map((item) => [item.id, item]))

  for (const item of nextItems) {
    byId.set(item.id, item)
  }

  return sortReviewItems(Array.from(byId.values()))
}

async function persistQueueState(snapshot: SmsImportReviewQueueSnapshot): Promise<void> {
  await AsyncStorage.setItem(SMS_IMPORT_REVIEW_QUEUE_KEY, JSON.stringify(snapshot))
}

export type SmsImportReviewStore = typeof smsImportReviewStore

export const smsImportReviewStore = createStore({
  context: {
    items: [] as SmsImportReviewItem[],
    lastScanCursor: null as string | null,
    bootstrapCompletedAt: null as string | null,
    isLoading: true,
  },

  on: {
    loadQueueState: (context, event: SmsImportReviewQueueSnapshot) => ({
      ...context,
      items: sortReviewItems(event.items),
      lastScanCursor: event.lastScanCursor,
      bootstrapCompletedAt: event.bootstrapCompletedAt,
      isLoading: false,
    }),

    upsertReviewItems: (
      context,
      event: {
        items: SmsImportReviewItem[]
        lastScanCursor?: string | null
        bootstrapCompletedAt?: string | null
      },
      enqueue
    ) => {
      const nextContext = {
        ...context,
        items: mergeReviewItems(context.items, event.items),
        lastScanCursor:
          event.lastScanCursor === undefined
            ? context.lastScanCursor
            : event.lastScanCursor,
        bootstrapCompletedAt:
          event.bootstrapCompletedAt === undefined
            ? context.bootstrapCompletedAt
            : event.bootstrapCompletedAt,
      }

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextContext.items,
          lastScanCursor: nextContext.lastScanCursor,
          bootstrapCompletedAt: nextContext.bootstrapCompletedAt,
        })
      })

      return nextContext
    },

    markItemAccepted: (
      context,
      event: { id: string; acceptedExpenseId?: string },
      enqueue
    ) => {
      const now = new Date().toISOString()
      const nextItems = context.items.map((item) =>
        item.id === event.id
          ? {
              ...item,
              status: "accepted" as const,
              acceptedExpenseId: event.acceptedExpenseId,
              updatedAt: now,
            }
          : item
      )

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextItems,
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })
      })

      return {
        ...context,
        items: nextItems,
      }
    },

    markItemRejected: (context, event: { id: string }, enqueue) => {
      const now = new Date().toISOString()
      const nextItems = context.items.map((item) =>
        item.id === event.id
          ? {
              ...item,
              status: "rejected" as const,
              updatedAt: now,
            }
          : item
      )

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextItems,
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })
      })

      return {
        ...context,
        items: nextItems,
      }
    },

    dismissItem: (context, event: { id: string }, enqueue) => {
      const now = new Date().toISOString()
      const nextItems = context.items.map((item) =>
        item.id === event.id
          ? {
              ...item,
              status: "dismissed" as const,
              updatedAt: now,
            }
          : item
      )

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextItems,
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })
      })

      return {
        ...context,
        items: nextItems,
      }
    },

    clearResolvedItems: (context, _event, enqueue) => {
      const nextItems = context.items.filter((item) => item.status === "pending")

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextItems,
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })
      })

      return {
        ...context,
        items: nextItems,
      }
    },

    setLastScanCursor: (context, event: { cursor: string | null }, enqueue) => {
      const nextContext = {
        ...context,
        lastScanCursor: event.cursor,
      }

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextContext.items,
          lastScanCursor: nextContext.lastScanCursor,
          bootstrapCompletedAt: nextContext.bootstrapCompletedAt,
        })
      })

      return nextContext
    },

    setBootstrapCompletedAt: (
      context,
      event: { completedAt: string | null },
      enqueue
    ) => {
      const nextContext = {
        ...context,
        bootstrapCompletedAt: event.completedAt,
      }

      enqueue.effect(async () => {
        await persistQueueState({
          items: nextContext.items,
          lastScanCursor: nextContext.lastScanCursor,
          bootstrapCompletedAt: nextContext.bootstrapCompletedAt,
        })
      })

      return nextContext
    },
  },
})

export async function initializeSmsImportReviewStore(): Promise<void> {
  try {
    const rawValue = await AsyncStorage.getItem(SMS_IMPORT_REVIEW_QUEUE_KEY)
    if (!rawValue) {
      smsImportReviewStore.trigger.loadQueueState({
        items: [],
        lastScanCursor: null,
        bootstrapCompletedAt: null,
      })
      return
    }

    const parsed = JSON.parse(rawValue) as Partial<SmsImportReviewQueueSnapshot>
    smsImportReviewStore.trigger.loadQueueState({
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lastScanCursor: parsed.lastScanCursor ?? null,
      bootstrapCompletedAt: parsed.bootstrapCompletedAt ?? null,
    })
  } catch (error) {
    console.warn("Failed to initialize SMS import review store:", error)
    smsImportReviewStore.trigger.loadQueueState({
      items: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })
  }
}
