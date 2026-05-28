import { createStore } from "@xstate/store"
import { SmsImportReviewItem } from "../types/sms-import"
import {
  approveReviewItemAsync,
  approveReviewItemsAsync,
  dismissReviewItemAsync,
  insertPendingItemsAsync,
  rejectReviewItemAsync,
  rejectReviewItemsAsync,
} from "../services/background-sms/android-background-sms-module"

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
  const byFingerprint = new Map<string, SmsImportReviewItem>()
  for (const item of existingItems) {
    byFingerprint.set(item.fingerprint, item)
  }
  for (const item of nextItems) {
    const existing = byFingerprint.get(item.fingerprint)
    if (!existing) {
      byFingerprint.set(item.fingerprint, item)
    } else {
      const existingResolved = existing.status !== "pending"
      const itemResolved = item.status !== "pending"
      if (
        (itemResolved && !existingResolved) ||
        (itemResolved === existingResolved &&
          new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime())
      ) {
        byFingerprint.set(item.fingerprint, item)
      }
    }
  }
  return sortReviewItems(Array.from(byFingerprint.values()))
}

export function createSmsImportReviewStore() {
  return createStore({
    context: {
      items: [] as SmsImportReviewItem[],
      lastScanCursor: null as string | null,
      bootstrapCompletedAt: null as string | null,
      isLoading: true,
    },

    on: {
      loadQueueState: (
        context,
        event: {
          items: SmsImportReviewItem[]
          lastScanCursor: string | null
          bootstrapCompletedAt: string | null
          isLoading?: boolean
        }
      ) => ({
        ...context,
        items: sortReviewItems(event.items),
        lastScanCursor: event.lastScanCursor,
        bootstrapCompletedAt: event.bootstrapCompletedAt,
        isLoading: event.isLoading ?? false,
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
        const merged = mergeReviewItems(context.items, event.items)

        enqueue.effect(async () => {
          await insertPendingItemsAsync(event.items)
        })

        return {
          ...context,
          items: merged,
          lastScanCursor:
            event.lastScanCursor === undefined
              ? context.lastScanCursor
              : event.lastScanCursor,
          bootstrapCompletedAt:
            event.bootstrapCompletedAt === undefined
              ? context.bootstrapCompletedAt
              : event.bootstrapCompletedAt,
        }
      },

      markItemAccepted: (
        context,
        event: { fingerprint: string; acceptedExpenseId?: string },
        enqueue
      ) => {
        enqueue.effect(async () => {
          await approveReviewItemAsync(event.fingerprint)
        })

        return {
          ...context,
          items: context.items.map((item) =>
            item.fingerprint === event.fingerprint
              ? {
                  ...item,
                  status: "accepted" as const,
                  acceptedExpenseId: event.acceptedExpenseId,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }
      },

      markItemsAccepted: (
        context,
        event: { acceptedItems: Array<{ fingerprint: string }> },
        enqueue
      ) => {
        if (event.acceptedItems.length === 0) return context

        const acceptedFingerprints = new Set(
          event.acceptedItems.map((item) => item.fingerprint)
        )

        const fingerprints = event.acceptedItems.map((item) => item.fingerprint)
        enqueue.effect(async () => {
          await approveReviewItemsAsync(fingerprints)
        })

        return {
          ...context,
          items: context.items.map((item) =>
            acceptedFingerprints.has(item.fingerprint)
              ? {
                  ...item,
                  status: "accepted" as const,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }
      },

      markItemsRejected: (context, event: { fingerprints: string[] }, enqueue) => {
        if (event.fingerprints.length === 0) return context

        const rejectedFingerprints = new Set(event.fingerprints)

        enqueue.effect(async () => {
          await rejectReviewItemsAsync(event.fingerprints)
        })

        return {
          ...context,
          items: context.items.map((item) =>
            rejectedFingerprints.has(item.fingerprint)
              ? {
                  ...item,
                  status: "rejected" as const,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }
      },

      markItemRejected: (context, event: { fingerprint: string }, enqueue) => {
        enqueue.effect(async () => {
          await rejectReviewItemAsync(event.fingerprint)
        })

        return {
          ...context,
          items: context.items.map((item) =>
            item.fingerprint === event.fingerprint
              ? {
                  ...item,
                  status: "rejected" as const,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }
      },

      dismissItem: (context, event: { fingerprint: string }, enqueue) => {
        enqueue.effect(async () => {
          await dismissReviewItemAsync(event.fingerprint)
        })

        return {
          ...context,
          items: context.items.map((item) =>
            item.fingerprint === event.fingerprint
              ? {
                  ...item,
                  status: "dismissed" as const,
                  updatedAt: new Date().toISOString(),
                }
              : item
          ),
        }
      },

      clearResolvedItems: (context) => ({
        ...context,
        items: context.items.filter((item) => item.status === "pending"),
      }),

      setLastScanCursor: (context, event: { cursor: string | null }) => ({
        ...context,
        lastScanCursor: event.cursor,
      }),

      setBootstrapCompletedAt: (context, event: { completedAt: string | null }) => ({
        ...context,
        bootstrapCompletedAt: event.completedAt,
      }),
    },
  })
}

export type SmsImportReviewStore = ReturnType<typeof createSmsImportReviewStore>

export const smsImportReviewStore = createSmsImportReviewStore()

export async function initializeSmsImportReviewStore(
  store: SmsImportReviewStore = smsImportReviewStore
): Promise<{
  lastScanCursor: string | null
  bootstrapCompletedAt: string | null
}> {
  store.trigger.loadQueueState({
    items: [],
    lastScanCursor: null,
    bootstrapCompletedAt: null,
  })
  return { lastScanCursor: null, bootstrapCompletedAt: null }
}
