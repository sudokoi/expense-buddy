import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { SmsImportReviewItem, SmsImportReviewQueueSnapshot } from "../types/sms-import"

const SMS_IMPORT_REVIEW_QUEUE_KEY = "sms_import_review_queue_state_v1"
const RESOLVED_ITEM_RETENTION_DAYS = 7

function getRetentionReferenceTime(item: SmsImportReviewItem): number {
  const updatedAt = new Date(item.updatedAt).getTime()
  if (Number.isFinite(updatedAt)) {
    return updatedAt
  }

  const createdAt = new Date(item.createdAt).getTime()
  if (Number.isFinite(createdAt)) {
    return createdAt
  }

  return new Date(item.sourceMessage.receivedAt).getTime()
}

function pruneExpiredResolvedItems(
  items: SmsImportReviewItem[],
  now: number = Date.now()
): SmsImportReviewItem[] {
  const retentionWindowMs = RESOLVED_ITEM_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const cutoff = now - retentionWindowMs

  return items.filter((item) => {
    if (item.status === "pending") {
      return true
    }

    return getRetentionReferenceTime(item) >= cutoff
  })
}

function normalizeReviewItems(
  items: SmsImportReviewItem[],
  now: number = Date.now()
): SmsImportReviewItem[] {
  return sortReviewItems(pruneExpiredResolvedItems(items, now))
}

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

  return normalizeReviewItems(Array.from(byId.values()))
}

function createQueueSnapshot(
  input: Pick<
    SmsImportReviewQueueSnapshot,
    "items" | "lastScanCursor" | "bootstrapCompletedAt"
  >,
  now: number = Date.now()
): SmsImportReviewQueueSnapshot {
  return {
    items: normalizeReviewItems(input.items, now),
    lastScanCursor: input.lastScanCursor,
    bootstrapCompletedAt: input.bootstrapCompletedAt,
  }
}

function applyQueueSnapshot(
  context: { isLoading: boolean },
  snapshot: SmsImportReviewQueueSnapshot
) {
  return {
    ...context,
    items: snapshot.items,
    lastScanCursor: snapshot.lastScanCursor,
    bootstrapCompletedAt: snapshot.bootstrapCompletedAt,
  }
}

async function persistQueueState(snapshot: SmsImportReviewQueueSnapshot): Promise<void> {
  await AsyncStorage.setItem(SMS_IMPORT_REVIEW_QUEUE_KEY, JSON.stringify(snapshot))
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
      loadQueueState: (context, event: SmsImportReviewQueueSnapshot) => ({
        ...applyQueueSnapshot(context, createQueueSnapshot(event)),
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
        const snapshot = createQueueSnapshot({
          items: mergeReviewItems(context.items, event.items),
          lastScanCursor:
            event.lastScanCursor === undefined
              ? context.lastScanCursor
              : event.lastScanCursor,
          bootstrapCompletedAt:
            event.bootstrapCompletedAt === undefined
              ? context.bootstrapCompletedAt
              : event.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      markItemAccepted: (
        context,
        event: { id: string; acceptedExpenseId?: string },
        enqueue
      ) => {
        const now = new Date().toISOString()
        const snapshot = createQueueSnapshot({
          items: context.items.map((item) =>
            item.id === event.id
              ? {
                  ...item,
                  status: "accepted" as const,
                  acceptedExpenseId: event.acceptedExpenseId,
                  updatedAt: now,
                }
              : item
          ),
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      markItemsAccepted: (
        context,
        event: { acceptedItems: Array<{ id: string; acceptedExpenseId?: string }> },
        enqueue
      ) => {
        if (event.acceptedItems.length === 0) {
          return context
        }

        const acceptedById = new Map(
          event.acceptedItems.map((item) => [item.id, item.acceptedExpenseId])
        )
        const now = new Date().toISOString()
        const snapshot = createQueueSnapshot({
          items: context.items.map((item) => {
            if (!acceptedById.has(item.id)) {
              return item
            }

            return {
              ...item,
              status: "accepted" as const,
              acceptedExpenseId: acceptedById.get(item.id),
              updatedAt: now,
            }
          }),
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      markItemRejected: (context, event: { id: string }, enqueue) => {
        const now = new Date().toISOString()
        const snapshot = createQueueSnapshot({
          items: context.items.map((item) =>
            item.id === event.id
              ? {
                  ...item,
                  status: "rejected" as const,
                  updatedAt: now,
                }
              : item
          ),
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      dismissItem: (context, event: { id: string }, enqueue) => {
        const now = new Date().toISOString()
        const snapshot = createQueueSnapshot({
          items: context.items.map((item) =>
            item.id === event.id
              ? {
                  ...item,
                  status: "dismissed" as const,
                  updatedAt: now,
                }
              : item
          ),
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      clearResolvedItems: (context, _event, enqueue) => {
        const snapshot = createQueueSnapshot({
          items: context.items.filter((item) => item.status === "pending"),
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      setLastScanCursor: (context, event: { cursor: string | null }, enqueue) => {
        const snapshot = createQueueSnapshot({
          items: context.items,
          lastScanCursor: event.cursor,
          bootstrapCompletedAt: context.bootstrapCompletedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      setBootstrapCompletedAt: (
        context,
        event: { completedAt: string | null },
        enqueue
      ) => {
        const snapshot = createQueueSnapshot({
          items: context.items,
          lastScanCursor: context.lastScanCursor,
          bootstrapCompletedAt: event.completedAt,
        })

        enqueue.effect(async () => {
          await persistQueueState(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },
    },
  })
}

export type SmsImportReviewStore = ReturnType<typeof createSmsImportReviewStore>

export const smsImportReviewStore = createSmsImportReviewStore()

export async function initializeSmsImportReviewStore(
  store: SmsImportReviewStore = smsImportReviewStore
): Promise<void> {
  try {
    const rawValue = await AsyncStorage.getItem(SMS_IMPORT_REVIEW_QUEUE_KEY)
    if (!rawValue) {
      const snapshot = createQueueSnapshot({
        items: [],
        lastScanCursor: null,
        bootstrapCompletedAt: null,
      })
      store.trigger.loadQueueState(snapshot)
      return
    }

    const parsed = JSON.parse(rawValue) as Partial<SmsImportReviewQueueSnapshot>
    const rawSnapshot = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lastScanCursor: parsed.lastScanCursor ?? null,
      bootstrapCompletedAt: parsed.bootstrapCompletedAt ?? null,
    }
    const normalizedSnapshot = createQueueSnapshot(rawSnapshot)

    store.trigger.loadQueueState(normalizedSnapshot)

    if (JSON.stringify(rawSnapshot) !== JSON.stringify(normalizedSnapshot)) {
      await persistQueueState(normalizedSnapshot)
    }
  } catch (error) {
    console.warn("Failed to initialize SMS import review store:", error)
    const snapshot = createQueueSnapshot({
      items: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })
    store.trigger.loadQueueState(snapshot)
  }
}
