import { createStore } from "@xstate/store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { SmsImportReviewItem, SmsImportReviewQueueSnapshot } from "../types/sms-import"
import {
  loadBackgroundSmsReviewQueueSnapshot,
  saveBackgroundSmsReviewQueueSnapshot,
} from "../services/background-sms/android-background-sms-module"

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

  // Deduplicate by fingerprint: if two items share the same fingerprint
  // (same SMS content) but have different IDs (e.g. native bg vs JS bootstrap),
  // prefer the item with a resolved status (accepted/rejected/dismissed) over
  // a pending one, regardless of timestamp. If both have the same resolution
  // status, keep the one with the latest updatedAt.
  const byFingerprint = new Map<string, SmsImportReviewItem>()
  for (const item of Array.from(byId.values())) {
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

  return normalizeReviewItems(Array.from(byFingerprint.values()))
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

let persistSequence = Promise.resolve()

async function persistQueueState(snapshot: SmsImportReviewQueueSnapshot): Promise<void> {
  await AsyncStorage.setItem(SMS_IMPORT_REVIEW_QUEUE_KEY, JSON.stringify(snapshot))
  await saveBackgroundSmsReviewQueueSnapshot(snapshot)
}

function enqueuePersist(snapshot: SmsImportReviewQueueSnapshot): Promise<void> {
  persistSequence = persistSequence.then(
    () => persistQueueState(snapshot),
    () => persistQueueState(snapshot),
  )
  return persistSequence
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
        })

        return applyQueueSnapshot(context, snapshot)
      },

      markItemsRejected: (context, event: { ids: string[] }, enqueue) => {
        if (event.ids.length === 0) {
          return context
        }

        const rejectedIds = new Set(event.ids)
        const now = new Date().toISOString()
        const snapshot = createQueueSnapshot({
          items: context.items.map((item) =>
            rejectedIds.has(item.id)
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
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
          await enqueuePersist(snapshot)
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
    const [rawValue, nativeSnapshot] = await Promise.all([
      AsyncStorage.getItem(SMS_IMPORT_REVIEW_QUEUE_KEY),
      loadBackgroundSmsReviewQueueSnapshot(),
    ])

    let parsed: Partial<SmsImportReviewQueueSnapshot> | null = null
    if (rawValue) {
      try {
        parsed = JSON.parse(rawValue) as Partial<SmsImportReviewQueueSnapshot>
      } catch (error) {
        console.warn("Failed to parse persisted SMS import review queue state:", error)
      }
    }

    const storedSnapshot = {
      items: Array.isArray(parsed?.items) ? parsed!.items : [],
      lastScanCursor: parsed?.lastScanCursor ?? null,
      bootstrapCompletedAt: parsed?.bootstrapCompletedAt ?? null,
    }
    const mergedSnapshot = createQueueSnapshot({
      items: mergeReviewItems(storedSnapshot.items, nativeSnapshot?.items ?? []),
      lastScanCursor: nativeSnapshot?.lastScanCursor ?? storedSnapshot.lastScanCursor,
      bootstrapCompletedAt:
        nativeSnapshot?.bootstrapCompletedAt ?? storedSnapshot.bootstrapCompletedAt,
    })

    store.trigger.loadQueueState(mergedSnapshot)

    if (
      JSON.stringify(storedSnapshot) !== JSON.stringify(mergedSnapshot) ||
      JSON.stringify(nativeSnapshot ?? null) !== JSON.stringify(mergedSnapshot)
    ) {
      await enqueuePersist(mergedSnapshot)
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
