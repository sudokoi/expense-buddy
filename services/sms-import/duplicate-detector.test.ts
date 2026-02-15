/**
 * Duplicate Detector Tests
 *
 * Tests for pure functions in the duplicate detector
 */

import { DuplicateDetector } from "./duplicate-detector"
import { ParsedTransaction } from "../../types/sms-import"

describe("DuplicateDetector", () => {
  const detector = new DuplicateDetector()

  describe("calculateSimilarity", () => {
    it.each([
      ["swiggy", "swiggy", 1.0],
      ["Swiggy", "swiggy", 1.0],
      ["Amazon", "amazon", 1.0],
      ["Starbucks", "starbucks coffee", 0.82],
      ["Whole Foods", "wholefoods", 0.64],
      ["Test", "Best", 0.75],
      ["", "", 1.0],
    ])("should calculate similarity between '%s' and '%s' as %s", (a, b, expected) => {
      const result = detector.calculateSimilarity(a, b)
      expect(result).toBeCloseTo(expected, 1)
    })

    it("should return 0 for completely different strings", () => {
      const result = detector.calculateSimilarity("abc", "xyz")
      expect(result).toBe(0)
    })

    it("should be case-insensitive", () => {
      const result1 = detector.calculateSimilarity("SWIGGY", "swiggy")
      const result2 = detector.calculateSimilarity("Swiggy", "SWIGGY")
      expect(result1).toBe(1.0)
      expect(result2).toBe(1.0)
    })
  })

  describe("check", () => {
    beforeEach(async () => {
      await detector.initialize()
    })

    it("should detect duplicate by message ID", async () => {
      const transaction: ParsedTransaction = {
        amount: 100,
        currency: "INR",
        merchant: "Test",
        date: new Date().toISOString(),
        paymentMethod: "UPI",
        transactionType: "debit",
        confidenceScore: 0.9,
        metadata: {
          source: "sms",
          rawMessage: "Test message",
          sender: "AD-TEST",
          messageId: "abc123",
          confidenceScore: 0.9,
          parsedAt: new Date().toISOString(),
        },
      }

      // First check - should not be duplicate
      const result1 = await detector.check(transaction)
      expect(result1.isDuplicate).toBe(false)

      // Mark as processed
      await detector.markProcessed("abc123")

      // Second check - should be duplicate
      const result2 = await detector.check(transaction)
      expect(result2.isDuplicate).toBe(true)
      expect(result2.reason).toBe("message_id")
      expect(result2.confidence).toBe(1.0)
    })

    it("should not flag different messages as duplicates", async () => {
      const transaction1: ParsedTransaction = {
        amount: 100,
        currency: "INR",
        merchant: "Test1",
        date: new Date().toISOString(),
        paymentMethod: "UPI",
        transactionType: "debit",
        confidenceScore: 0.9,
        metadata: {
          source: "sms",
          rawMessage: "Test message 1",
          sender: "AD-TEST1",
          messageId: "id1",
          confidenceScore: 0.9,
          parsedAt: new Date().toISOString(),
        },
      }

      const transaction2: ParsedTransaction = {
        amount: 200,
        currency: "INR",
        merchant: "Test2",
        date: new Date().toISOString(),
        paymentMethod: "UPI",
        transactionType: "debit",
        confidenceScore: 0.9,
        metadata: {
          source: "sms",
          rawMessage: "Test message 2",
          sender: "AD-TEST2",
          messageId: "id2",
          confidenceScore: 0.9,
          parsedAt: new Date().toISOString(),
        },
      }

      await detector.markProcessed("id1")

      const result = await detector.check(transaction2)
      expect(result.isDuplicate).toBe(false)
      expect(result.reason).toBe("none")
    })
  })

  describe("markProcessed", () => {
    it("should add message ID to processed set", async () => {
      await detector.markProcessed("test-id-1")
      await detector.markProcessed("test-id-2")

      const transaction: ParsedTransaction = {
        amount: 100,
        currency: "INR",
        merchant: "Test",
        date: new Date().toISOString(),
        paymentMethod: "UPI",
        transactionType: "debit",
        confidenceScore: 0.9,
        metadata: {
          source: "sms",
          rawMessage: "Test",
          sender: "AD-TEST",
          messageId: "test-id-1",
          confidenceScore: 0.9,
          parsedAt: new Date().toISOString(),
        },
      }

      const result = await detector.check(transaction)
      expect(result.isDuplicate).toBe(true)
    })

    it("should handle empty ID gracefully", async () => {
      await expect(detector.markProcessed("")).resolves.not.toThrow()
    })
  })
})
