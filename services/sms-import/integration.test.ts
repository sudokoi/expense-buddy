/**
 * SMS Import Integration Tests
 *
 * Tests for SMS import infrastructure and flow
 * Note: These tests verify the SMS import system works correctly
 */

// Mock native SMS module
jest.mock("@maniac-tech/react-native-expo-read-sms", () => ({
  startReadSMS: jest.fn().mockReturnValue(jest.fn()),
  requestReadSMSPermission: jest.fn().mockResolvedValue(true),
}))

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

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}))

// Mock expo-notifications
jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}))

// Mock react-native-fast-tflite
jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: jest.fn().mockResolvedValue({
    run: jest.fn().mockResolvedValue([new ArrayBuffer(128 * 7 * 4)]),
  }),
  TensorflowModel: class MockTensorflowModel {
    run = jest.fn().mockResolvedValue([new ArrayBuffer(128 * 7 * 4)])
  },
}))

import { SMSListener } from "./sms-listener"
import { initializeSMSImport, disposeSMSImport } from "./index"
import { reviewQueueStore } from "../../stores/review-queue-store"
import type { PaymentMethodType } from "../../types/expense"

describe("SMS Import Integration", () => {
  let smsListener: SMSListener

  beforeEach(async () => {
    // Create fresh instance for each test
    smsListener = new SMSListener()

    // Reset stores
    reviewQueueStore.trigger.loadQueue({ items: [] })

    // Clear all mocks
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await smsListener.dispose()
  })

  describe("SMS Listener Lifecycle", () => {
    it("should initialize without throwing", async () => {
      await expect(initializeSMSImport()).resolves.not.toThrow()
    })

    it("should dispose without throwing", async () => {
      await expect(disposeSMSImport()).resolves.not.toThrow()
    })

    it("should track active state", () => {
      expect(smsListener.isActive()).toBe(false)
    })
  })

  describe("SMS Processing", () => {
    it("should handle incoming messages without crashing", async () => {
      const message =
        "Rs.1,500.00 debited from a/c **1234 on 15-02-2024 at Swiggy. Avl Bal: Rs.25,430.50"

      // Should not throw even if ML parsing fails
      await expect(smsListener.handleIncomingMessage(message)).resolves.not.toThrow()
    })

    it("should handle non-transaction SMS without crashing", async () => {
      const message = "Hello, how are you? This is not a transaction."

      // Should not throw for non-transaction messages
      await expect(smsListener.handleIncomingMessage(message)).resolves.not.toThrow()
    })
  })

  describe("Review Queue", () => {
    it("should add items to queue", () => {
      const mockItem = {
        id: "test-id-123",
        parsedTransaction: {
          amount: 500,
          currency: "INR",
          merchant: "TestMerchant",
          date: new Date().toISOString(),
          paymentMethod: "UPI" as PaymentMethodType,
          transactionType: "debit" as const,
          confidenceScore: 0.85,
          metadata: {
            source: "sms" as const,
            rawMessage: "Test message",
            sender: "Unknown",
            messageId: "msg-test",
            confidenceScore: 0.85,
            parsedAt: new Date().toISOString(),
          },
        },
        suggestedCategory: "Food",
        suggestedPaymentMethod: "UPI" as PaymentMethodType,
        suggestedInstrument: undefined,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      }

      reviewQueueStore.trigger.addItem({ item: mockItem })

      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(1)
      expect(queue[0].parsedTransaction.merchant).toBe("TestMerchant")
    })

    it("should remove items from queue", () => {
      const mockItem = {
        id: "test-id-456",
        parsedTransaction: {
          amount: 1000,
          currency: "INR",
          merchant: "Amazon",
          date: new Date().toISOString(),
          paymentMethod: "Credit Card" as PaymentMethodType,
          transactionType: "debit" as const,
          confidenceScore: 0.9,
          metadata: {
            source: "sms" as const,
            rawMessage: "Test message 2",
            sender: "Unknown",
            messageId: "msg-test-2",
            confidenceScore: 0.9,
            parsedAt: new Date().toISOString(),
          },
        },
        suggestedCategory: "Shopping",
        suggestedPaymentMethod: "Credit Card" as PaymentMethodType,
        suggestedInstrument: undefined,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      }

      reviewQueueStore.trigger.addItem({ item: mockItem })

      const itemId = reviewQueueStore.getSnapshot().context.queue[0].id
      reviewQueueStore.trigger.removeItem({ itemId })

      const queue = reviewQueueStore.getSnapshot().context.queue
      expect(queue.length).toBe(0)
    })

    it("should track queue stats", () => {
      const item1 = {
        id: "test-1",
        parsedTransaction: {
          amount: 100,
          currency: "INR",
          merchant: "Merchant1",
          date: new Date().toISOString(),
          paymentMethod: "Cash" as PaymentMethodType,
          transactionType: "debit" as const,
          confidenceScore: 0.8,
          metadata: {
            source: "sms" as const,
            rawMessage: "Test",
            sender: "Unknown",
            messageId: "msg-1",
            confidenceScore: 0.8,
            parsedAt: new Date().toISOString(),
          },
        },
        suggestedCategory: "Other",
        suggestedPaymentMethod: "Cash" as PaymentMethodType,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      }

      const item2 = {
        id: "test-2",
        parsedTransaction: {
          amount: 200,
          currency: "INR",
          merchant: "Merchant2",
          date: new Date().toISOString(),
          paymentMethod: "UPI" as PaymentMethodType,
          transactionType: "debit" as const,
          confidenceScore: 0.85,
          metadata: {
            source: "sms" as const,
            rawMessage: "Test 2",
            sender: "Unknown",
            messageId: "msg-2",
            confidenceScore: 0.85,
            parsedAt: new Date().toISOString(),
          },
        },
        suggestedCategory: "Other",
        suggestedPaymentMethod: "UPI" as PaymentMethodType,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      }

      reviewQueueStore.trigger.addItem({ item: item1 })
      reviewQueueStore.trigger.addItem({ item: item2 })

      const stats = reviewQueueStore.getSnapshot().context.stats
      expect(stats.totalImported).toBe(2)
      expect(stats.pendingReview).toBe(2)
    })
  })
})
