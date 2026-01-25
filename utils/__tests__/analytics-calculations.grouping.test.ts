import { groupExpensesByCurrency } from "../analytics-calculations"
import { Expense } from "../../types/expense"

describe("groupExpensesByCurrency", () => {
  const mockExpenses: Expense[] = [
    {
      id: "1",
      amount: 100,
      currency: "USD",
      category: "Food",
      date: "2023-01-01",
      note: "",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "2",
      amount: 200,
      currency: "EUR",
      category: "Transport",
      date: "2023-01-02",
      note: "",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "3",
      amount: 50,
      currency: "USD",
      category: "Snacks",
      date: "2023-01-01",
      note: "",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "4",
      amount: 150,
      currency: undefined, // Should fallback
      category: "Unknown",
      date: "2023-01-03",
      note: "",
      createdAt: "",
      updatedAt: "",
    },
  ]

  it("should group expenses by currency", () => {
    const defaultCurrency = "INR"
    const grouped = groupExpensesByCurrency(mockExpenses, defaultCurrency)

    expect(grouped.size).toBe(3)

    const usdExpenses = grouped.get("USD")
    expect(usdExpenses).toBeDefined()
    expect(usdExpenses?.length).toBe(2)
    expect(usdExpenses?.map((e) => e.id)).toEqual(["1", "3"])

    const eurExpenses = grouped.get("EUR")
    expect(eurExpenses).toBeDefined()
    expect(eurExpenses?.length).toBe(1)
    expect(eurExpenses?.[0].id).toBe("2")

    const inrExpenses = grouped.get("INR") // Fallback
    expect(inrExpenses).toBeDefined()
    expect(inrExpenses?.length).toBe(1)
    expect(inrExpenses?.[0].id).toBe("4")
  })

  it("should handle empty expenses", () => {
    const grouped = groupExpensesByCurrency([], "INR")
    expect(grouped.size).toBe(0)
  })

  it("should fallback individually for missing currency", () => {
    const expenses: Expense[] = [
      {
        id: "1",
        amount: 10,
        currency: "USD",
        category: "",
        date: "",
        note: "",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        amount: 20,
        currency: undefined,
        category: "",
        date: "",
        note: "",
        createdAt: "",
        updatedAt: "",
      },
    ]
    const grouped = groupExpensesByCurrency(expenses, "GBP")

    expect(grouped.get("USD")?.length).toBe(1)
    expect(grouped.get("GBP")?.length).toBe(1)
  })
})
