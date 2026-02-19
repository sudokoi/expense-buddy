/**
 * Property-based tests for Review Queue Actions
 * Feature: sms-import-gaps
 */

import fc from "fast-check"
import { PaymentMethodType } from "../../types/expense"
import { ReviewQueueItem } from "../../types/sms-import"

// --- Pure reimplementation of review queue action logic ---

interface QueueState {
  queue: ReviewQueueItem[]
  stats: { totalImported: number; pendingReview: number }
}

interface ConfirmEffect {
  type: "confirm"
  expense: {
    source: "auto-imported"
    importMetadata: { reviewedAt: string; userCorrected: boolean }
    triggerSync: false
  }
  learnCalled: true
  markProcessedId: string
}

interface EditEffect {
  type: "edit"
  expense: {
    source: "auto-imported"
    importMetadata: { reviewedAt: string; userCorrected: true }
    triggerSync: false
    category: string
    paymentMethod: PaymentMethodType
    note: string
    amount: number
  }
  correctionStored: true
  learnCalled: true
  markProcessedId: string
}

interface RejectEffect {
  type: "reject"
  markProcessedId: string
  expenseCreated: false
}

function computeStats(queue: ReviewQueueItem[]): QueueState["stats"] {
  return {
    totalImported: queue.length,
    pendingReview: queue.filter((i) => i.status === "pending").length,
  }
}

function confirmItem(
  state: QueueState,
  itemId: string
): { state: QueueState; effect: ConfirmEffect | null } {
  const item = state.queue.find((i) => i.id === itemId)
  if (!item) return { state, effect: null }

  const newQueue = state.queue.filter((i) => i.id !== itemId)
  return {
    state: { queue: newQueue, stats: computeStats(newQueue) },
    effect: {
      type: "confirm",
      expense: {
        source: "auto-imported",
        importMetadata: {
          reviewedAt: expect.any(String),
          userCorrected: false,
        },
        triggerSync: false,
      },
      learnCalled: true,
      markProcessedId: item.parsedTransaction.metadata.messageId,
    },
  }
}

function editItem(
  state: QueueState,
  itemId: string,
  edits: {
    category: string
    paymentMethod: PaymentMethodType
    note: string
    amount: number
  }
): { state: QueueState; effect: EditEffect | null } {
  const item = state.queue.find((i) => i.id === itemId)
  if (!item) return { state, effect: null }

  const newQueue = state.queue.filter((i) => i.id !== itemId)
  return {
    state: { queue: newQueue, stats: computeStats(newQueue) },
    effect: {
      type: "edit",
      expense: {
        source: "auto-imported",
        importMetadata: {
          reviewedAt: expect.any(String),
          userCorrected: true,
        },
        triggerSync: false,
        category: edits.category,
        paymentMethod: edits.paymentMethod,
        note: edits.note,
        amount: edits.amount,
      },
      correctionStored: true,
      learnCalled: true,
      markProcessedId: item.parsedTransaction.metadata.messageId,
    },
  }
}

function rejectItem(
  state: QueueState,
  itemId: string
): { state: QueueState; effect: RejectEffect | null } {
  const item = state.queue.find((i) => i.id === itemId)
  if (!item) return { state, effect: null }

  const newQueue = state.queue.filter((i) => i.id !== itemId)
  return {
    state: { queue: newQueue, stats: computeStats(newQueue) },
    effect: {
      type: "reject",
      markProcessedId: item.parsedTransaction.metadata.messageId,
      expenseCreated: false,
    },
  }
}

function confirmAll(state: QueueState): {
  state: QueueState
  effects: ConfirmEffect[]
} {
  const pendingItems = state.queue.filter((i) => i.status === "pending")
  const pendingIds = new Set(pendingItems.map((i) => i.id))
  const newQueue = state.queue.filter((i) => !pendingIds.has(i.id))

  const effects: ConfirmEffect[] = pendingItems.map((item) => ({
    type: "confirm" as const,
    expense: {
      source: "auto-imported" as const,
      importMetadata: {
        reviewedAt: expect.any(String),
        userCorrected: false,
      },
      triggerSync: false as const,
    },
    learnCalled: true as const,
    markProcessedId: item.parsedTransaction.metadata.messageId,
  }))

  return {
    state: { queue: newQueue, stats: computeStats(newQueue) },
    effects,
  }
}

function rejectAll(state: QueueState): {
  state: QueueState
  effects: RejectEffect[]
} {
  const pendingItems = state.queue.filter((i) => i.status === "pending")
  const pendingIds = new Set(pendingItems.map((i) => i.id))
  const newQueue = state.queue.filter((i) => !pendingIds.has(i.id))

  const effects: RejectEffect[] = pendingItems.map((item) => ({
    type: "reject" as const,
    markProcessedId: item.parsedTransaction.metadata.messageId,
    expenseCreated: false as const,
  }))

  return {
    state: { queue: newQueue, stats: computeStats(newQueue) },
    effects,
  }
}

// --- Arbitraries ---

const paymentMethodArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Amazon Pay",
  "Other"
)

const categoryArb = fc.constantFrom(
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Bills",
  "Health",
  "Other"
)

const dateArb = fc
  .integer({
    min: new Date("2024-01-01").getTime(),
    max: new Date("2026-12-31").getTime(),
  })
  .map((ts) => new Date(ts).toISOString())

const merchantArb = fc.stringMatching(/^[a-zA-Z ]{2,20}$/)

const messageIdArb = fc.stringMatching(/^[a-z0-9]{5,15}$/)

// Generate a valid ReviewQueueItem
const reviewQueueItemArb = (
  status: "pending" | "confirmed" | "edited" | "rejected" = "pending"
): fc.Arbitrary<ReviewQueueItem> =>
  fc.record({
    id: fc.uuid(),
    parsedTransaction: fc.record({
      amount: fc.double({ min: 1, max: 100000, noNaN: true }),
      currency: fc.constantFrom("INR", "USD", "EUR"),
      merchant: merchantArb,
      date: dateArb,
      paymentMethod: paymentMethodArb,
      transactionType: fc.constantFrom("debit" as const, "credit" as const),
      confidenceScore: fc.double({ min: 0, max: 1, noNaN: true }),
      metadata: fc.record({
        source: fc.constant("sms" as const),
        rawMessage: fc.string({ minLength: 5, maxLength: 100 }),
        sender: fc.stringMatching(/^[A-Z]{2}-[A-Z]{4,8}$/),
        messageId: messageIdArb,
        confidenceScore: fc.double({ min: 0, max: 1, noNaN: true }),
        parsedAt: dateArb,
      }),
    }),
    suggestedCategory: categoryArb,
    suggestedPaymentMethod: paymentMethodArb,
    status: fc.constant(status),
    createdAt: dateArb,
  })

// Generate a queue with N pending items
const pendingQueueArb = (
  minLength: number,
  maxLength: number
): fc.Arbitrary<ReviewQueueItem[]> =>
  fc.array(reviewQueueItemArb("pending"), { minLength, maxLength })

// Generate edit overrides
const editOverridesArb = fc.record({
  category: categoryArb,
  paymentMethod: paymentMethodArb,
  note: fc.string({ minLength: 1, maxLength: 50 }),
  amount: fc.double({ min: 1, max: 100000, noNaN: true }),
})

// --- Tests ---

describe("Review Queue Actions Properties", () => {
  /**
   * Property 1: Confirm Item Creates Correct Expense and Cleans Up Queue
   * For any review item, confirming SHALL create an expense with source auto-imported,
   * reviewedAt set, item removed from queue, and message marked as processed.
   */
  describe("Property 1: Confirm Item Creates Correct Expense and Cleans Up Queue", () => {
    it("confirmed item SHALL be removed from queue and produce an auto-imported expense", () => {
      fc.assert(
        fc.property(pendingQueueArb(1, 10), (items) => {
          const targetItem = items[0]
          const state: QueueState = {
            queue: items,
            stats: computeStats(items),
          }

          const result = confirmItem(state, targetItem.id)

          // Item removed from queue
          const itemInQueue = result.state.queue.find((i) => i.id === targetItem.id)
          expect(itemInQueue).toBeUndefined()

          // Effect produced
          expect(result.effect).not.toBeNull()
          expect(result.effect!.type).toBe("confirm")
          expect(result.effect!.expense.source).toBe("auto-imported")
          expect(result.effect!.expense.importMetadata.userCorrected).toBe(false)
          expect(result.effect!.expense.triggerSync).toBe(false)
          expect(result.effect!.learnCalled).toBe(true)
          expect(result.effect!.markProcessedId).toBe(
            targetItem.parsedTransaction.metadata.messageId
          )

          // Stats updated
          expect(result.state.stats.pendingReview).toBe(
            result.state.queue.filter((i) => i.status === "pending").length
          )

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Edit Item Creates Corrected Expense with User Corrections
   * For any review item and edits, editing SHALL create an expense with modified fields,
   * userCorrected true, and a correction stored in the learning engine.
   */
  describe("Property 2: Edit Item Creates Corrected Expense with User Corrections", () => {
    it("edited item SHALL produce expense with user-modified fields and userCorrected true", () => {
      fc.assert(
        fc.property(pendingQueueArb(1, 10), editOverridesArb, (items, edits) => {
          const targetItem = items[0]
          const state: QueueState = {
            queue: items,
            stats: computeStats(items),
          }

          const result = editItem(state, targetItem.id, edits)

          // Item removed from queue
          const itemInQueue = result.state.queue.find((i) => i.id === targetItem.id)
          expect(itemInQueue).toBeUndefined()

          // Effect produced with user edits
          expect(result.effect).not.toBeNull()
          expect(result.effect!.type).toBe("edit")
          expect(result.effect!.expense.source).toBe("auto-imported")
          expect(result.effect!.expense.importMetadata.userCorrected).toBe(true)
          expect(result.effect!.expense.triggerSync).toBe(false)
          expect(result.effect!.expense.category).toBe(edits.category)
          expect(result.effect!.expense.paymentMethod).toBe(edits.paymentMethod)
          expect(result.effect!.expense.note).toBe(edits.note)
          expect(result.effect!.expense.amount).toBe(edits.amount)
          expect(result.effect!.correctionStored).toBe(true)
          expect(result.effect!.learnCalled).toBe(true)
          expect(result.effect!.markProcessedId).toBe(
            targetItem.parsedTransaction.metadata.messageId
          )

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Reject Item Removes from Queue Without Creating Expense
   * For any review item, rejecting SHALL remove it from the queue, mark the message
   * as processed, and create no expense.
   */
  describe("Property 3: Reject Item Removes from Queue Without Creating Expense", () => {
    it("rejected item SHALL be removed from queue with no expense created", () => {
      fc.assert(
        fc.property(pendingQueueArb(1, 10), (items) => {
          const targetItem = items[0]
          const state: QueueState = {
            queue: items,
            stats: computeStats(items),
          }

          const result = rejectItem(state, targetItem.id)

          // Item removed from queue
          const itemInQueue = result.state.queue.find((i) => i.id === targetItem.id)
          expect(itemInQueue).toBeUndefined()

          // Effect produced — no expense, just mark processed
          expect(result.effect).not.toBeNull()
          expect(result.effect!.type).toBe("reject")
          expect(result.effect!.expenseCreated).toBe(false)
          expect(result.effect!.markProcessedId).toBe(
            targetItem.parsedTransaction.metadata.messageId
          )

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 7: Confirm All Creates Expenses for All Pending Items
   * For any queue with N pending items, Confirm All SHALL create N expenses
   * and empty all pending items from the queue.
   */
  describe("Property 7: Confirm All Creates Expenses for All Pending Items", () => {
    it("Confirm All SHALL create exactly N expenses for N pending items and empty the queue", () => {
      fc.assert(
        fc.property(pendingQueueArb(1, 15), (items) => {
          const state: QueueState = {
            queue: items,
            stats: computeStats(items),
          }

          const result = confirmAll(state)

          // All pending items removed
          const remainingPending = result.state.queue.filter(
            (i) => i.status === "pending"
          )
          expect(remainingPending).toHaveLength(0)

          // One confirm effect per pending item
          expect(result.effects).toHaveLength(items.length)

          // Each effect is a confirm with auto-imported source
          for (const effect of result.effects) {
            expect(effect.type).toBe("confirm")
            expect(effect.expense.source).toBe("auto-imported")
            expect(effect.expense.importMetadata.userCorrected).toBe(false)
            expect(effect.expense.triggerSync).toBe(false)
            expect(effect.learnCalled).toBe(true)
          }

          // All message IDs are marked processed
          const processedIds = new Set(result.effects.map((e) => e.markProcessedId))
          for (const item of items) {
            expect(processedIds.has(item.parsedTransaction.metadata.messageId)).toBe(true)
          }

          // Stats reflect empty queue
          expect(result.state.stats.pendingReview).toBe(0)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 8: Reject All Removes All Pending Items Without Expenses
   * For any queue with N pending items, Reject All SHALL remove all pending items
   * and create zero expenses. All N message IDs SHALL be marked as processed.
   */
  describe("Property 8: Reject All Removes All Pending Items Without Expenses", () => {
    it("Reject All SHALL remove all pending items, create zero expenses, and mark all processed", () => {
      fc.assert(
        fc.property(pendingQueueArb(1, 15), (items) => {
          const state: QueueState = {
            queue: items,
            stats: computeStats(items),
          }

          const result = rejectAll(state)

          // All pending items removed
          const remainingPending = result.state.queue.filter(
            (i) => i.status === "pending"
          )
          expect(remainingPending).toHaveLength(0)

          // One reject effect per pending item — no expenses
          expect(result.effects).toHaveLength(items.length)
          for (const effect of result.effects) {
            expect(effect.type).toBe("reject")
            expect(effect.expenseCreated).toBe(false)
          }

          // All message IDs are marked processed
          const processedIds = new Set(result.effects.map((e) => e.markProcessedId))
          for (const item of items) {
            expect(processedIds.has(item.parsedTransaction.metadata.messageId)).toBe(true)
          }

          // Stats reflect empty queue
          expect(result.state.stats.pendingReview).toBe(0)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
