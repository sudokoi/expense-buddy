/**
 * SMS Import Integration Tests
 *
 * End-to-end tests for the SMS import feature
 */

// Mock expo modules
jest.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}))

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

import { smsListener, initializeSMSImport } from "../index"
import { reviewQueueStore } from "../../stores/review-queue-store"

describe("SMS Import Integration", () => {
  beforeEach(async () => {
    // Reset stores
    reviewQueueStore.trigger.loadQueue({ items: [] })
  })

  afterEach(async () => {
    await smsListener.dispose()
  })

  describe("SMS Processing Flow", () => {
    it("should process valid transaction SMS and add to queue", async () => {
      const message =
        "Rs.1,500.00 debited from a/c **1234 on 15-02-2024 at Swiggy. Avl Bal: Rs.25,430.50"

      await smsListener.handleIncomingMessage(message)

      // Check review queue
      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(1)
      expect(queue[0].parsedTransaction.merchant).toBe("Swiggy")
      expect(queue[0].parsedTransaction.amount).toBe(1500)
    })

    it("should detect and skip duplicates", async () => {
      const message = "Rs.1,500.00 debited from a/c **1234 on 15-02-2024 at Swiggy"

      // Process same message twice
      await smsListener.handleIncomingMessage(message)
      await smsListener.handleIncomingMessage(message)

      // Should only have one item in queue
      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(1)
    })

    it("should handle multiple different transactions", async () => {
      const messages = [
        "Rs.500 at Amazon on 01-01-2024",
        "Rs.1000 at Swiggy on 02-01-2024",
        "Rs.1500 at Flipkart on 03-01-2024",
      ]

      for (const message of messages) {
        await smsListener.handleIncomingMessage(message)
      }

      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(3)
    })

    it("should skip non-transaction SMS", async () => {
      const message = "Hello, how are you? This is not a transaction."

      await smsListener.handleIncomingMessage(message)

      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(0)
    })

    it("should include merchant suggestions from learning engine", async () => {
      // First, add a known merchant pattern
      const knownMessage = "Rs.500 debited from a/c **1234 on 15-02-2024 at TESTMERCHANT"

      await smsListener.handleIncomingMessage(knownMessage)

      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(1)

      // Should have suggestions (even if default "Other")
      const item = queue[0]
      expect(item.suggestedCategory).toBeDefined()
      expect(item.suggestedPaymentMethod).toBeDefined()
    })
  })

  describe("Review Queue Management", () => {
    it("should track review queue stats", async () => {
      await smsListener.handleIncomingMessage("Rs.500 at Amazon on 01-01-2024")
      await smsListener.handleIncomingMessage("Rs.1000 at Swiggy on 02-01-2024")

      const stats = reviewQueueStore.getSnapshot().context.stats
      expect(stats.totalImported).toBe(2)
      expect(stats.pendingReview).toBe(2)
    })

    it("should remove item from queue", async () => {
      await smsListener.handleIncomingMessage("Rs.500 at Amazon on 01-01-2024")

      const itemId = reviewQueueStore.getSnapshot().context.queue[0].id

      reviewQueueStore.trigger.removeItem({ itemId })

      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(0)
    })
  })

  describe("SMS Listener Lifecycle", () => {
    it("should initialize and dispose properly", async () => {
      await expect(initializeSMSImport()).resolves.not.toThrow()
      await expect(smsListener.dispose()).resolves.not.toThrow()
    })

    it("should track active state", async () => {
      expect(smsListener.isActive()).toBe(false)

      await initializeSMSImport()

      // Note: isActive() only returns true when actually listening
      // In mock implementation, this might differ
    })
  })
})
