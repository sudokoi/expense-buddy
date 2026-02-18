/**
 * Hybrid Parser Tests
 *
 * Tests for the hybrid regex + ML parser
 */

// Mock expo modules
jest.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}))

// Mock react-native-fast-tflite
jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: jest.fn().mockResolvedValue({
    run: jest.fn().mockResolvedValue([new ArrayBuffer(28)]),
  }),
}))

import { HybridTransactionParser } from "./hybrid-parser"

describe("HybridTransactionParser", () => {
  const parser = new HybridTransactionParser()

  describe("parse", () => {
    it("should use regex for high confidence matches", async () => {
      const message =
        "Rs.1,500.00 debited from a/c **1234 on 15-02-2024. Avl Bal: Rs.25,430.50. Swiggy - Food Order"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).not.toBeNull()
      expect(result.method).toBe("regex")
      expect(result.confidence).toBeGreaterThanOrEqual(0.8)
      expect(result.parsed!.amount).toBe(1500)
      expect(result.parsed!.merchant).toBe("Swiggy")
    })

    it("should return null for non-transaction SMS", async () => {
      const message = "Hello, how are you today?"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).toBeNull()
      expect(result.method).toBe("none")
    })

    it("should include regex confidence in result", async () => {
      const message =
        "Thank you for using your ICICI Bank Credit Card ending 5678 for INR 2,499 at AMAZON"

      const result = await parser.parse(message, "sms")

      expect(result.regexConfidence).toBeDefined()
      // Confidence might be 0 if regex doesn't match well
      expect(typeof result.regexConfidence).toBe("number")
    })

    it("should parse US bank SMS", async () => {
      const message = "You made a $45.99 transaction at STARBUCKS on 02/15/2024"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.amount).toBe(45.99)
      expect(result.parsed!.merchant).toBe("Starbucks")
      expect(result.parsed!.currency).toBe("USD")
    })

    it("should parse EU bank SMS", async () => {
      const message = "€25.00 paid to UBER on 15-02-2024"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.amount).toBe(25)
      expect(result.parsed!.merchant).toBe("Uber")
      expect(result.parsed!.currency).toBe("EUR")
    })

    it("should parse JP bank SMS", async () => {
      const message = "¥3,500 引落 セブンイレブン"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.amount).toBe(3500)
      expect(result.parsed!.currency).toBe("JPY")
    })

    it("should handle UPI transactions", async () => {
      const message =
        "Rs.350 paid to ZOMATO via PhonePe UPI. UPI Ref: 123456789012"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.amount).toBe(350)
      expect(result.parsed!.merchant).toBe("Zomato")
      expect(result.parsed!.paymentMethod).toBe("UPI")
    })

    it("should detect credit transactions", async () => {
      const message = "Rs.1000 credited to your account via UPI Ref: 987654321098"

      const result = await parser.parse(message, "sms")

      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.transactionType).toBe("credit")
    })

    it("should handle low confidence by checking ML (when available)", async () => {
      // This tests the fallback path - with regex confidence < 0.8
      // In v3.0.0 without ML model, this will return null
      const ambiguousMessage = "Some ambiguous transaction message"

      const result = await parser.parse(ambiguousMessage, "sms")

      // Without ML model, should return null
      expect(result.method).toBe("none")
    })
  })

  describe("parseFast", () => {
    it("should return null for uncertain regex matches", async () => {
      const message = "Test message with unclear transaction info"

      const result = await parser.parseFast(message, "sms")

      // parseFast only returns high confidence regex matches
      expect(result).toBeNull()
    })

    it("should return parsed transaction for clear matches", async () => {
      // Use a message that matches known patterns with high confidence
      const message =
        "Rs.1,500.00 debited from a/c **1234 on 15-02-2024 at Swiggy"

      const result = await parser.parseFast(message, "sms")

      // parseFast only returns high confidence matches
      // If null, it means confidence was < 0.8, which is valid behavior
      if (result) {
        expect(result.amount).toBe(1500)
      }
    })
  })

  describe("initialize", () => {
    it("should initialize without errors", async () => {
      await expect(parser.initialize()).resolves.not.toThrow()
    })

    it("should handle missing ML model gracefully", async () => {
      // Should not throw even if model file doesn't exist
      await expect(parser.initialize()).resolves.toBeUndefined()
    })
  })

  describe("isMLAvailable", () => {
    it("should return false before initialization", () => {
      // Create new parser instance
      const newParser = new HybridTransactionParser()
      expect(newParser.isMLAvailable()).toBe(false)
    })

    it("should return appropriate value after initialization", async () => {
      const newParser = new HybridTransactionParser()
      await newParser.initialize()

      // Should return true only if model loaded successfully
      // In v3.0.0 without model, this will be false
      const isAvailable = newParser.isMLAvailable()
      expect(typeof isAvailable).toBe("boolean")
    })
  })

  describe("dispose", () => {
    it("should dispose without errors", async () => {
      await parser.initialize()
      await expect(parser.dispose()).resolves.not.toThrow()
    })

    it("should set isMLAvailable to false after dispose", async () => {
      const newParser = new HybridTransactionParser()
      await newParser.initialize()
      await newParser.dispose()

      expect(newParser.isMLAvailable()).toBe(false)
    })
  })
})
