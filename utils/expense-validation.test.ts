/**
 * Unit tests for Expense Validation
 * Tests the Zod-based validation for expense forms
 */

import { validateExpenseForm } from "./expense-validation"

describe("Expense Validation", () => {
  describe("Amount validation", () => {
    it('should return "Amount must be a valid number" for non-numeric amount', () => {
      const result = validateExpenseForm({
        amount: "abc",
        category: "Food",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.amount).toBe("Amount must be a valid number")
      }
    })

    it('should return "Amount must be positive" for negative amount', () => {
      const result = validateExpenseForm({
        amount: "-10",
        category: "Food",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.amount).toBe("Amount must be positive")
      }
    })

    it('should return "Amount must be positive" for zero amount', () => {
      const result = validateExpenseForm({
        amount: "0",
        category: "Food",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.amount).toBe("Amount must be positive")
      }
    })

    it('should return "Amount is required" for empty amount', () => {
      const result = validateExpenseForm({
        amount: "",
        category: "Food",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.amount).toBe("Amount is required")
      }
    })
  })

  describe("Valid data", () => {
    it("should return success for valid expense data", () => {
      const result = validateExpenseForm({
        amount: "25.50",
        category: "Food",
        note: "Lunch",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe("25.50")
        expect(result.data.category).toBe("Food")
        expect(result.data.note).toBe("Lunch")
      }
    })

    it("should return success for valid expense with payment method", () => {
      const result = validateExpenseForm({
        amount: "100",
        category: "Transport",
        paymentMethodType: "Credit Card",
        paymentMethodId: "1234",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.paymentMethodType).toBe("Credit Card")
        expect(result.data.paymentMethodId).toBe("1234")
      }
    })

    it("should return success for valid expense without optional fields", () => {
      const result = validateExpenseForm({
        amount: "50",
        category: "Groceries",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe("50")
        expect(result.data.category).toBe("Groceries")
        expect(result.data.note).toBeUndefined()
        expect(result.data.paymentMethodType).toBeUndefined()
      }
    })

    it("should accept decimal amounts", () => {
      const result = validateExpenseForm({
        amount: "123.45",
        category: "Food",
      })

      expect(result.success).toBe(true)
    })
  })

  describe("Category validation", () => {
    it("should accept all valid categories", () => {
      const categories = [
        "Food",
        "Groceries",
        "Transport",
        "Utilities",
        "Entertainment",
        "Health",
        "Other",
      ]

      for (const category of categories) {
        const result = validateExpenseForm({
          amount: "10",
          category,
        })
        expect(result.success).toBe(true)
      }
    })

    it("should reject invalid category", () => {
      const result = validateExpenseForm({
        amount: "10",
        category: "InvalidCategory",
      })

      expect(result.success).toBe(false)
    })
  })

  describe("Payment method validation", () => {
    it("should accept all valid payment method types", () => {
      const paymentMethods = [
        "Cash",
        "UPI",
        "Credit Card",
        "Debit Card",
        "Net Banking",
        "Other",
      ]

      for (const paymentMethodType of paymentMethods) {
        const result = validateExpenseForm({
          amount: "10",
          category: "Food",
          paymentMethodType,
        })
        expect(result.success).toBe(true)
      }
    })

    it("should reject invalid payment method type", () => {
      const result = validateExpenseForm({
        amount: "10",
        category: "Food",
        paymentMethodType: "InvalidMethod",
      })

      expect(result.success).toBe(false)
    })
  })
})
