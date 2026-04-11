import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  createSmsImportReviewStore,
  initializeSmsImportReviewStore,
  smsImportReviewStore,
} from "./sms-import-review-store"
import type {
  SmsImportReviewItem,
  SmsImportReviewQueueSnapshot,
} from "../types/sms-import"

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>
const storage = new Map<string, string>()
const STORAGE_KEY = "sms_import_review_queue_state_v1"

function createItem(
  id: string,
  overrides: Partial<SmsImportReviewItem> = {}
): SmsImportReviewItem {
  return {
    id,
    fingerprint: `fingerprint_${id}`,
    sourceMessage: {
      messageId: id,
      sender: "VK-HDFCBK",
      body: `INR 100 spent at Merchant ${id}`,
      receivedAt: `2026-04-11T10:${id === "newer" ? "20" : "10"}:00.000Z`,
    },
    amount: 100,
    currency: "INR",
    merchantName: `Merchant ${id}`,
    categorySuggestion: "Shopping",
    noteSuggestion: `SMS import: Merchant ${id}`,
    transactionDate: `2026-04-11T10:${id === "newer" ? "20" : "10"}:00.000Z`,
    status: "pending",
    createdAt: "2026-04-11T10:30:00.000Z",
    updatedAt: "2026-04-11T10:30:00.000Z",
    ...overrides,
  }
}

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("smsImportReviewStore", () => {
  beforeEach(() => {
    storage.clear()
    jest.clearAllMocks()

    mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
      return storage.get(key) ?? null
    })
    mockAsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value)
    })
    mockAsyncStorage.removeItem.mockImplementation(async (key: string) => {
      storage.delete(key)
    })

    smsImportReviewStore.trigger.loadQueueState({
      items: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    })
  })

  it("loads a persisted snapshot from AsyncStorage", async () => {
    const snapshot: SmsImportReviewQueueSnapshot = {
      items: [createItem("older"), createItem("newer")],
      lastScanCursor: "2026-04-11T10:20:00.000Z",
      bootstrapCompletedAt: "2026-04-11T10:30:00.000Z",
    }
    storage.set(STORAGE_KEY, JSON.stringify(snapshot))

    await initializeSmsImportReviewStore()

    const context = smsImportReviewStore.getSnapshot().context
    expect(context.items.map((item) => item.id)).toEqual(["newer", "older"])
    expect(context.lastScanCursor).toBe("2026-04-11T10:20:00.000Z")
    expect(context.bootstrapCompletedAt).toBe("2026-04-11T10:30:00.000Z")
    expect(context.isLoading).toBe(false)
  })

  it("prunes resolved items older than 7 days but keeps pending items", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const snapshot: SmsImportReviewQueueSnapshot = {
      items: [
        createItem("old-accepted", {
          status: "accepted",
          updatedAt: eightDaysAgo,
          createdAt: eightDaysAgo,
        }),
        createItem("old-pending", {
          status: "pending",
          updatedAt: eightDaysAgo,
          createdAt: eightDaysAgo,
        }),
      ],
      lastScanCursor: "2026-04-11T10:20:00.000Z",
      bootstrapCompletedAt: "2026-04-11T10:30:00.000Z",
    }
    storage.set(STORAGE_KEY, JSON.stringify(snapshot))

    await initializeSmsImportReviewStore()

    const context = smsImportReviewStore.getSnapshot().context
    expect(context.items.map((item) => item.id)).toEqual(["old-pending"])
    const persistedSnapshot = JSON.parse(
      storage.get(STORAGE_KEY) || "{}"
    ) as SmsImportReviewQueueSnapshot
    expect(persistedSnapshot.items.map((item) => item.id)).toEqual(["old-pending"])
    expect(persistedSnapshot.lastScanCursor).toBe("2026-04-11T10:20:00.000Z")
    expect(persistedSnapshot.bootstrapCompletedAt).toBe("2026-04-11T10:30:00.000Z")
  })

  it("can initialize an injected review store instance", async () => {
    const alternateStore = createSmsImportReviewStore()
    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        items: [createItem("alternate")],
        lastScanCursor: "2026-04-11T10:20:00.000Z",
        bootstrapCompletedAt: "2026-04-11T10:30:00.000Z",
      } satisfies SmsImportReviewQueueSnapshot)
    )

    await initializeSmsImportReviewStore(alternateStore)

    const context = alternateStore.getSnapshot().context
    expect(context.items.map((item) => item.id)).toEqual(["alternate"])
    expect(context.isLoading).toBe(false)
  })

  it("upserts items in reverse chronological order and persists the snapshot", async () => {
    smsImportReviewStore.trigger.upsertReviewItems({
      items: [createItem("older"), createItem("newer")],
      lastScanCursor: "2026-04-11T10:20:00.000Z",
      bootstrapCompletedAt: "2026-04-11T10:30:00.000Z",
    })

    await flushEffects()

    const context = smsImportReviewStore.getSnapshot().context
    expect(context.items.map((item) => item.id)).toEqual(["newer", "older"])

    expect(mockAsyncStorage.setItem).toHaveBeenCalled()
    expect(JSON.parse(storage.get(STORAGE_KEY) || "{}")).toMatchObject({
      lastScanCursor: "2026-04-11T10:20:00.000Z",
      bootstrapCompletedAt: "2026-04-11T10:30:00.000Z",
    })
  })

  it("marks items resolved and clears them when requested", async () => {
    smsImportReviewStore.trigger.upsertReviewItems({
      items: [createItem("older"), createItem("newer")],
    })
    await flushEffects()

    smsImportReviewStore.trigger.markItemRejected({ id: "older" })
    await flushEffects()
    smsImportReviewStore.trigger.clearResolvedItems()
    await flushEffects()

    const context = smsImportReviewStore.getSnapshot().context
    expect(context.items.map((item) => item.id)).toEqual(["newer"])
  })

  it("marks multiple items accepted with a single persisted snapshot", async () => {
    smsImportReviewStore.trigger.upsertReviewItems({
      items: [createItem("older"), createItem("newer")],
    })
    await flushEffects()
    jest.clearAllMocks()

    smsImportReviewStore.trigger.markItemsAccepted({
      acceptedItems: [
        { id: "older", acceptedExpenseId: "expense-1" },
        { id: "newer", acceptedExpenseId: "expense-2" },
      ],
    })
    await flushEffects()

    const context = smsImportReviewStore.getSnapshot().context
    expect(context.items.every((item) => item.status === "accepted")).toBe(true)
    expect(context.items.map((item) => item.acceptedExpenseId)).toEqual([
      "expense-2",
      "expense-1",
    ])
    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it("prunes expired resolved items when a later mutation persists the queue", async () => {
    jest.useFakeTimers()
    try {
      jest.setSystemTime(new Date("2026-04-11T10:30:00.000Z"))

      smsImportReviewStore.trigger.loadQueueState({
        items: [
          createItem("resolved", {
            status: "accepted",
            updatedAt: "2026-04-11T10:30:00.000Z",
            createdAt: "2026-04-11T10:30:00.000Z",
          }),
          createItem("pending"),
        ],
        lastScanCursor: null,
        bootstrapCompletedAt: null,
      })

      jest.setSystemTime(new Date("2026-04-19T10:30:00.000Z"))

      smsImportReviewStore.trigger.markItemRejected({ id: "pending" })
      await jest.runAllTimersAsync()

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items.map((item) => item.id)).toEqual(["pending"])
      expect(context.items[0]?.status).toBe("rejected")
    } finally {
      jest.useRealTimers()
    }
  })
})
