/**
 * Learning Engine Tests
 *
 * Tests for pure functions in the merchant learning engine
 */

import { MerchantLearningEngine } from "./learning-engine"

describe("MerchantLearningEngine", () => {
  const engine = new MerchantLearningEngine()

  describe("normalizeMerchant", () => {
    it.each([
      ["Swiggy", "swiggy"],
      ["SWIGGY", "swiggy"],
      ["Company PVT LTD", "company"],
      ["Business Inc.", "business"],
      ["Test Limited", "test"],
      ["Corp. Name", "name"],
      ["  Spaces  ", "spaces"],
      ["Special!@#Chars", "specialchars"],
    ])("should normalize '%s' to '%s'", (input, expected) => {
      const result = (engine as any).normalizeMerchant(input)
      expect(result).toBe(expected)
    })

    it("should handle empty string", () => {
      const result = (engine as any).normalizeMerchant("")
      expect(result).toBe("")
    })

    it("should handle special characters", () => {
      const result = (engine as any).normalizeMerchant("A&B Co.")
      expect(result).toBe("abco")
    })
  })

  describe("shouldOverwritePattern", () => {
    const mockPattern = {
      id: "test-id",
      normalizedName: "swiggy",
      rawPatterns: ["Swiggy"],
      category: "Food",
      paymentMethod: "UPI" as const,
      confidence: 0.8,
      usageCount: 5,
      lastUsed: new Date().toISOString(),
      userOverridden: false,
    }

    const mockExpense = {
      id: "exp-1",
      amount: 500,
      category: "Food",
      date: new Date().toISOString(),
      note: "Swiggy Food",
      paymentMethod: { type: "UPI" as const },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const mockParsed = {
      amount: 500,
      currency: "INR",
      merchant: "Swiggy Food Delivery",
      date: new Date().toISOString(),
      paymentMethod: "UPI" as const,
      transactionType: "debit" as const,
      confidenceScore: 0.9,
      rawMessage: "Test",
      metadata: {
        source: "sms" as const,
        sender: "AD-TEST",
        messageId: "123",
        confidenceScore: 0.9,
        parsedAt: new Date().toISOString(),
      },
    }

    it("should return false for same category within 24h", () => {
      const result = (engine as any).shouldOverwritePattern(
        mockPattern,
        mockExpense,
        mockParsed
      )
      expect(result).toBe(false)
    })

    it("should return true for different category within 24h", () => {
      const differentCategory = { ...mockExpense, category: "Shopping" }
      const result = (engine as any).shouldOverwritePattern(
        mockPattern,
        differentCategory,
        mockParsed
      )
      expect(result).toBe(true)
    })

    it("should return false for old patterns (>24h)", () => {
      const oldPattern = {
        ...mockPattern,
        lastUsed: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      }
      const result = (engine as any).shouldOverwritePattern(
        oldPattern,
        mockExpense,
        mockParsed
      )
      expect(result).toBe(false)
    })
  })

  describe("findSimilarMerchants", () => {
    beforeEach(async () => {
      await (engine as any).loadPatterns()
    })

    it("should find exact match", async () => {
      // Add a pattern first
      await engine.learnFromExpense(
        {
          id: "exp-1",
          amount: 100,
          category: "Food",
          date: new Date().toISOString(),
          note: "Swiggy",
          paymentMethod: { type: "UPI" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          amount: 100,
          currency: "INR",
          merchant: "Swiggy",
          date: new Date().toISOString(),
          paymentMethod: "UPI",
          transactionType: "debit",
          confidenceScore: 0.9,
          rawMessage: "Test",
          metadata: {
            source: "sms",
            sender: "AD-TEST",
            messageId: "123",
            confidenceScore: 0.9,
            parsedAt: new Date().toISOString(),
          },
        }
      )

      const matches = await (engine as any).findSimilarMerchants("swiggy")
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].similarity).toBe(1.0)
    })

    it("should return empty array for no matches", async () => {
      const matches = await (engine as any).findSimilarMerchants(
        "nonexistentmerchant12345"
      )
      expect(matches).toEqual([])
    })
  })

  describe("learnFromExpense", () => {
    it("should create new pattern for unknown merchant", async () => {
      const expense = {
        id: "exp-1",
        amount: 500,
        category: "Food",
        date: new Date().toISOString(),
        note: "NewMerchant",
        paymentMethod: { type: "UPI" as const },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const parsed = {
        amount: 500,
        currency: "INR",
        merchant: "NewMerchant",
        date: new Date().toISOString(),
        paymentMethod: "UPI" as const,
        transactionType: "debit" as const,
        confidenceScore: 0.9,
        rawMessage: "Test",
        metadata: {
          source: "sms" as const,
          sender: "AD-TEST",
          messageId: "123",
          confidenceScore: 0.9,
          parsedAt: new Date().toISOString(),
        },
      }

      await engine.learnFromExpense(expense, parsed)

      const patterns = await engine.getAllPatterns()
      const pattern = patterns.find((p) => p.normalizedName === "newmerchant")
      expect(pattern).toBeDefined()
      expect(pattern?.category).toBe("Food")
      expect(pattern?.usageCount).toBe(1)
    })

    it("should update existing pattern on confirmation", async () => {
      const expense = {
        id: "exp-1",
        amount: 500,
        category: "Food",
        date: new Date().toISOString(),
        note: "UpdateTest",
        paymentMethod: { type: "UPI" as const },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const parsed = {
        amount: 500,
        currency: "INR",
        merchant: "UpdateTest",
        date: new Date().toISOString(),
        paymentMethod: "UPI" as const,
        transactionType: "debit" as const,
        confidenceScore: 0.9,
        rawMessage: "Test",
        metadata: {
          source: "sms" as const,
          sender: "AD-TEST",
          messageId: "123",
          confidenceScore: 0.9,
          parsedAt: new Date().toISOString(),
        },
      }

      // Learn once
      await engine.learnFromExpense(expense, parsed)
      // Learn again
      await engine.learnFromExpense(expense, parsed)

      const patterns = await engine.getAllPatterns()
      const pattern = patterns.find((p) => p.normalizedName === "updatetest")
      expect(pattern?.usageCount).toBe(2)
    })
  })

  describe("suggest", () => {
    it("should return null for unknown merchant", async () => {
      const suggestion = await engine.suggest("UnknownMerchantXYZ123")
      expect(suggestion).toBeNull()
    })

    it("should suggest based on learned pattern", async () => {
      // First learn a pattern
      await engine.learnFromExpense(
        {
          id: "exp-1",
          amount: 500,
          category: "Food",
          date: new Date().toISOString(),
          note: "LearnedMerchant",
          paymentMethod: { type: "UPI" as const },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          importMetadata: {
            source: "sms" as const,
            sender: "AD-TEST",
            messageId: "123",
            confidenceScore: 0.9,
            parsedAt: new Date().toISOString(),
            userCorrected: true,
          },
        },
        {
          amount: 500,
          currency: "INR",
          merchant: "LearnedMerchant",
          date: new Date().toISOString(),
          paymentMethod: "UPI" as const,
          transactionType: "debit" as const,
          confidenceScore: 0.9,
          rawMessage: "Test",
          metadata: {
            source: "sms" as const,
            sender: "AD-TEST",
            messageId: "123",
            confidenceScore: 0.9,
            parsedAt: new Date().toISOString(),
          },
        }
      )

      const suggestion = await engine.suggest("LearnedMerchant")
      expect(suggestion).not.toBeNull()
      expect(suggestion?.category).toBe("Food")
      expect(suggestion?.paymentMethod).toBe("UPI")
    })
  })

  describe("addCorrection", () => {
    it("should add user correction", async () => {
      const correction = {
        id: "corr-1",
        originalMerchant: "TestMerchant",
        correctedCategory: "Shopping",
        correctedPaymentMethod: "Credit Card" as const,
        timestamp: new Date().toISOString(),
        applyToFuture: true,
      }

      await engine.addCorrection(correction)

      const corrections = await engine.getAllCorrections()
      expect(corrections.length).toBeGreaterThan(0)
      expect(corrections[corrections.length - 1].originalMerchant).toBe("TestMerchant")
    })
  })
})
