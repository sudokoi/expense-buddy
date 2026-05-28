import {
  createSmsImportReviewStore,
  initializeSmsImportReviewStore,
  smsImportReviewStore,
} from "./sms-import-review-store"
import {
  approveReviewItemAsync,
  approveReviewItemsAsync,
  dismissReviewItemAsync,
  insertPendingItemsAsync,
  rejectReviewItemAsync,
  rejectReviewItemsAsync,
} from "../services/background-sms/android-background-sms-module"
import type { SmsImportReviewItem } from "../types/sms-import"

jest.mock("../services/background-sms/android-background-sms-module", () => ({
  approveReviewItemAsync: jest.fn(async () => undefined),
  approveReviewItemsAsync: jest.fn(async () => undefined),
  dismissReviewItemAsync: jest.fn(async () => undefined),
  insertPendingItemsAsync: jest.fn(async () => undefined),
  rejectReviewItemAsync: jest.fn(async () => undefined),
  rejectReviewItemsAsync: jest.fn(async () => undefined),
}))

const mockApproveReviewItemAsync = approveReviewItemAsync as jest.MockedFunction<
  typeof approveReviewItemAsync
>
const _mockApproveReviewItemsAsync = approveReviewItemsAsync as jest.MockedFunction<
  typeof approveReviewItemsAsync
>
const mockDismissReviewItemAsync = dismissReviewItemAsync as jest.MockedFunction<
  typeof dismissReviewItemAsync
>
const mockInsertPendingItemsAsync = insertPendingItemsAsync as jest.MockedFunction<
  typeof insertPendingItemsAsync
>
const mockRejectReviewItemAsync = rejectReviewItemAsync as jest.MockedFunction<
  typeof rejectReviewItemAsync
>
const mockRejectReviewItemsAsync = rejectReviewItemsAsync as jest.MockedFunction<
  typeof rejectReviewItemsAsync
>

function createItem(
  suffix: string,
  overrides: Partial<SmsImportReviewItem> = {}
): SmsImportReviewItem {
  return {
    id: `id-${suffix}`,
    fingerprint: `fp-${suffix}`,
    sourceMessage: {
      messageId: `msg-${suffix}`,
      sender: "ACME Corp",
      body: `Spent $10 at ACME ${suffix}`,
      receivedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    },
    amount: 10,
    currency: "INR",
    merchantName: "ACME Corp",
    status: "pending",
    createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    ...overrides,
  }
}

function resetMocks() {
  mockApproveReviewItemAsync.mockClear()
  mockDismissReviewItemAsync.mockClear()
  mockInsertPendingItemsAsync.mockClear()
  mockRejectReviewItemAsync.mockClear()
}

function resetStore() {
  smsImportReviewStore.trigger.loadQueueState({
    items: [],
    lastScanCursor: null,
    bootstrapCompletedAt: null,
    isLoading: true,
  })
}

describe("smsImportReviewStore", () => {
  beforeEach(() => {
    resetMocks()
    resetStore()
  })

  describe("initializeSmsImportReviewStore", () => {
    it("starts with an empty queue and no cursor", async () => {
      const result = await initializeSmsImportReviewStore()

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items).toHaveLength(0)
      expect(context.lastScanCursor).toBeNull()
      expect(context.bootstrapCompletedAt).toBeNull()
      expect(context.isLoading).toBe(false)
      expect(result).toEqual({
        lastScanCursor: null,
        bootstrapCompletedAt: null,
      })
    })

    it("can initialize an injected store instance", async () => {
      const alternateStore = createSmsImportReviewStore()

      const result = await initializeSmsImportReviewStore(alternateStore)

      const context = alternateStore.getSnapshot().context
      expect(context.items).toHaveLength(0)
      expect(context.lastScanCursor).toBeNull()
      expect(context.bootstrapCompletedAt).toBeNull()
      expect(context.isLoading).toBe(false)
      expect(result).toEqual({
        lastScanCursor: null,
        bootstrapCompletedAt: null,
      })
    })
  })

  describe("upsertReviewItems", () => {
    it("adds new items to the queue", () => {
      const item = createItem("first")

      smsImportReviewStore.trigger.upsertReviewItems({ items: [item] })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items.map((i) => i.fingerprint)).toEqual(["fp-first"])
    })

    it("inserts items into native via async effect", () => {
      const item = createItem("first")

      smsImportReviewStore.trigger.upsertReviewItems({ items: [item] })

      expect(mockInsertPendingItemsAsync).toHaveBeenCalledWith([item])
    })

    it("merges by fingerprint, preferring newer items", () => {
      const older = createItem("same-fp", {
        updatedAt: new Date(Date.now() - 60 * 1000).toISOString(),
      })
      const newer = createItem("same-fp", {
        updatedAt: new Date(Date.now() - 30 * 1000).toISOString(),
        merchantName: "Updated Corp",
      })

      smsImportReviewStore.trigger.upsertReviewItems({ items: [older] })
      smsImportReviewStore.trigger.upsertReviewItems({ items: [newer] })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items).toHaveLength(1)
      expect(context.items[0]?.merchantName).toBe("Updated Corp")
    })

    it("prefers resolved status over pending for same fingerprint", () => {
      const pending = createItem("same-fp", {
        status: "pending",
        updatedAt: new Date(Date.now() - 10 * 1000).toISOString(),
      })
      const accepted = createItem("same-fp", {
        status: "accepted",
        updatedAt: new Date(Date.now() - 60 * 1000).toISOString(), // older timestamp
      })

      smsImportReviewStore.trigger.upsertReviewItems({ items: [accepted] })
      smsImportReviewStore.trigger.upsertReviewItems({ items: [pending] })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items).toHaveLength(1)
      expect(context.items[0]?.status).toBe("accepted")
    })

    it("sorts items by receivedAt descending", () => {
      const older = createItem("older", {
        sourceMessage: {
          messageId: "msg-older",
          sender: "ACME Corp",
          body: "older",
          receivedAt: new Date(Date.now() - 120 * 1000).toISOString(),
        },
      })
      const newer = createItem("newer", {
        sourceMessage: {
          messageId: "msg-newer",
          sender: "ACME Corp",
          body: "newer",
          receivedAt: new Date(Date.now() - 30 * 1000).toISOString(),
        },
      })

      smsImportReviewStore.trigger.upsertReviewItems({ items: [older, newer] })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items.map((i) => i.id)).toEqual(["id-newer", "id-older"])
    })
  })

  describe("markItemAccepted", () => {
    it("updates the item status and calls approve async", () => {
      const item = createItem("test")
      smsImportReviewStore.trigger.upsertReviewItems({ items: [item] })

      smsImportReviewStore.trigger.markItemAccepted({ fingerprint: "fp-test" })

      const context = smsImportReviewStore.getSnapshot().context
      const updated = context.items.find((i) => i.fingerprint === "fp-test")
      expect(updated?.status).toBe("accepted")
      expect(mockApproveReviewItemAsync).toHaveBeenCalledWith("fp-test")
    })
  })

  describe("markItemRejected", () => {
    it("updates the item status and calls reject async", () => {
      const item = createItem("test")
      smsImportReviewStore.trigger.upsertReviewItems({ items: [item] })

      smsImportReviewStore.trigger.markItemRejected({ fingerprint: "fp-test" })

      const context = smsImportReviewStore.getSnapshot().context
      const updated = context.items.find((i) => i.fingerprint === "fp-test")
      expect(updated?.status).toBe("rejected")
      expect(mockRejectReviewItemAsync).toHaveBeenCalledWith("fp-test")
    })
  })

  describe("markItemsRejected", () => {
    it("updates multiple items and calls reject batch API", async () => {
      smsImportReviewStore.trigger.upsertReviewItems({
        items: [createItem("a"), createItem("b")],
      })

      smsImportReviewStore.trigger.markItemsRejected({
        fingerprints: ["fp-a", "fp-b"],
      })

      await new Promise(setImmediate)

      expect(mockRejectReviewItemsAsync).toHaveBeenCalledWith(["fp-a", "fp-b"])
    })
  })

  describe("dismissItem", () => {
    it("updates the item status and calls dismiss async", () => {
      const item = createItem("test")
      smsImportReviewStore.trigger.upsertReviewItems({ items: [item] })

      smsImportReviewStore.trigger.dismissItem({ fingerprint: "fp-test" })

      const context = smsImportReviewStore.getSnapshot().context
      const updated = context.items.find((i) => i.fingerprint === "fp-test")
      expect(updated?.status).toBe("dismissed")
      expect(mockDismissReviewItemAsync).toHaveBeenCalledWith("fp-test")
    })
  })

  describe("clearResolvedItems", () => {
    it("removes all resolved items keeping only pending", () => {
      smsImportReviewStore.trigger.upsertReviewItems({
        items: [
          createItem("pending-1"),
          createItem("accepted", { status: "accepted" }),
          createItem("rejected", { status: "rejected" }),
          createItem("dismissed", { status: "dismissed" }),
        ],
      })

      smsImportReviewStore.trigger.clearResolvedItems()

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items.map((i) => i.fingerprint)).toEqual(["fp-pending-1"])
    })
  })

  describe("loadQueueState", () => {
    it("replaces the entire queue state", () => {
      smsImportReviewStore.trigger.upsertReviewItems({
        items: [createItem("old")],
      })

      smsImportReviewStore.trigger.loadQueueState({
        items: [createItem("new")],
        lastScanCursor: "cursor-2",
        bootstrapCompletedAt: "2026-05-27T00:00:00.000Z",
      })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.items.map((i) => i.fingerprint)).toEqual(["fp-new"])
      expect(context.lastScanCursor).toBe("cursor-2")
      expect(context.bootstrapCompletedAt).toBe("2026-05-27T00:00:00.000Z")
      expect(context.isLoading).toBe(false)
    })
  })

  describe("setLastScanCursor", () => {
    it("updates the cursor", () => {
      smsImportReviewStore.trigger.setLastScanCursor({ cursor: "new-cursor" })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.lastScanCursor).toBe("new-cursor")
    })
  })

  describe("setBootstrapCompletedAt", () => {
    it("updates the bootstrap timestamp", () => {
      smsImportReviewStore.trigger.setBootstrapCompletedAt({
        completedAt: "2026-05-27T00:00:00.000Z",
      })

      const context = smsImportReviewStore.getSnapshot().context
      expect(context.bootstrapCompletedAt).toBe("2026-05-27T00:00:00.000Z")
    })
  })
})
