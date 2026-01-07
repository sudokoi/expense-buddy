/**
 * Property-based tests for Analytics Calculations
 * Feature: expense-analytics
 */

import fc from "fast-check"
import {
  filterExpensesByTimeWindow,
  aggregateByCategory,
  aggregateByDay,
  calculateStatistics,
  getDateRangeForTimeWindow,
  getTimeWindowDays,
  TimeWindow,
  filterExpensesByCategories,
  aggregateByPaymentMethod,
} from "./analytics-calculations"
import { Expense, ExpenseCategory, PaymentMethodType } from "../types/expense"
import { format, parseISO, subDays, isWithinInterval } from "date-fns"

// Helper to generate valid expense categories
const categoryArb = fc.constantFrom<ExpenseCategory>(
  "Food",
  "Groceries",
  "Transport",
  "Utilities",
  "Rent",
  "Entertainment",
  "Health",
  "Other"
)

// Helper to generate valid payment method types
const paymentMethodTypeArb = fc.constantFrom<PaymentMethodType>(
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Other"
)

// Helper to generate time windows
const timeWindowArb = fc.constantFrom<TimeWindow>("7d", "15d", "1m")

// Helper to generate a valid expense
const expenseArb = (dateRange?: { minDaysAgo: number; maxDaysAgo: number }) =>
  fc.record({
    id: fc.uuid(),
    amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    category: categoryArb,
    date: fc
      .integer({
        min: dateRange?.minDaysAgo ?? 0,
        max: dateRange?.maxDaysAgo ?? 60,
      })
      .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
    note: fc.string({ maxLength: 50 }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<Expense>

// Helper to generate a valid expense with optional payment method
const expenseWithPaymentMethodArb = (dateRange?: {
  minDaysAgo: number
  maxDaysAgo: number
}) =>
  fc.record({
    id: fc.uuid(),
    amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    category: categoryArb,
    date: fc
      .integer({
        min: dateRange?.minDaysAgo ?? 0,
        max: dateRange?.maxDaysAgo ?? 60,
      })
      .map((daysAgo) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd")),
    note: fc.string({ maxLength: 50 }),
    paymentMethod: fc.option(
      fc.record({
        type: paymentMethodTypeArb,
        identifier: fc.option(fc.stringMatching(/^\d{3,4}$/), { nil: undefined }),
      }),
      { nil: undefined }
    ),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  }) as fc.Arbitrary<Expense>

describe("Analytics Calculations Properties", () => {
  /**
   * Property 1: Time Window Filtering Correctness
   * For any set of expenses and any selected time window (7d, 15d, 1m),
   * all expenses in the filtered result should have dates within the specified
   * time range, and no expenses outside that range should be included.
   */
  describe("Property 1: Time Window Filtering Correctness", () => {
    it("should only include expenses within the time window", () => {
      fc.assert(
        fc.property(
          fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 60 }), {
            minLength: 0,
            maxLength: 50,
          }),
          timeWindowArb,
          (expenses, timeWindow) => {
            const filtered = filterExpensesByTimeWindow(expenses, timeWindow)
            const { start, end } = getDateRangeForTimeWindow(timeWindow)

            // All filtered expenses should be within the date range
            for (const expense of filtered) {
              const expenseDate = parseISO(expense.date)
              if (!isWithinInterval(expenseDate, { start, end })) {
                return false
              }
            }
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should not exclude any expenses that are within the time window", () => {
      fc.assert(
        fc.property(
          fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 60 }), {
            minLength: 0,
            maxLength: 50,
          }),
          timeWindowArb,
          (expenses, timeWindow) => {
            const filtered = filterExpensesByTimeWindow(expenses, timeWindow)
            const { start, end } = getDateRangeForTimeWindow(timeWindow)

            // Count expenses that should be in the result
            const expectedCount = expenses.filter((expense) => {
              try {
                const expenseDate = parseISO(expense.date)
                return isWithinInterval(expenseDate, { start, end })
              } catch {
                return false
              }
            }).length

            return filtered.length === expectedCount
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Pie Chart Category Aggregation
   * For any set of filtered expenses, the pie chart data should correctly aggregate
   * amounts by category such that the sum of all pie chart segment values equals
   * the total of all filtered expense amounts.
   */
  describe("Property 2: Pie Chart Category Aggregation", () => {
    it("should have pie chart total equal to sum of all expense amounts", () => {
      fc.assert(
        fc.property(
          fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
            minLength: 1,
            maxLength: 50,
          }),
          (expenses) => {
            const pieData = aggregateByCategory(expenses)

            // Sum of pie chart values
            const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0)

            // Sum of all expense amounts (absolute values)
            const expenseTotal = expenses.reduce((sum, e) => sum + Math.abs(e.amount), 0)

            // Should be equal within floating point tolerance
            return Math.abs(pieTotal - expenseTotal) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Pie Chart Excludes Zero Categories
   * For any set of filtered expenses, the pie chart data should not contain
   * any segments for categories that have zero total expenses.
   */
  describe("Property 3: Pie Chart Excludes Zero Categories", () => {
    it("should not include categories with zero value in pie chart", () => {
      fc.assert(
        fc.property(
          fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
            minLength: 0,
            maxLength: 50,
          }),
          (expenses) => {
            const pieData = aggregateByCategory(expenses)

            // All pie chart items should have value > 0
            return pieData.every((item) => item.value > 0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 4: Pie Chart Percentages Sum to 100
   * For any non-empty pie chart data, the sum of all segment percentages
   * should equal 100% (within floating-point tolerance).
   *
   * Feature: expense-analytics, Property 4: Pie Chart Percentages Sum to 100
   * Validates: Requirements 2.4
   */
  describe("Property 4: Pie Chart Percentages Sum to 100", () => {
    it("should have percentages sum to 100 for non-empty data", () => {
      fc.assert(
        fc.property(
          fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
            minLength: 1,
            maxLength: 50,
          }),
          (expenses) => {
            const pieData = aggregateByCategory(expenses)

            if (pieData.length === 0) {
              return true // Empty data is valid
            }

            const percentageSum = pieData.reduce((sum, item) => sum + item.percentage, 0)

            // Should sum to 100 within tolerance
            return Math.abs(percentageSum - 100) < 0.01
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

/**
 * Property 5: Line Chart Data Completeness
 * For any time window, the line chart data should contain exactly one data point
 * for each day in the period, with days having no expenses showing a value of zero,
 * and days with expenses showing the correct daily total.
 *
 * Feature: expense-analytics, Property 5: Line Chart Data Completeness
 * Validates: Requirements 3.1, 3.5
 */
describe("Property 5: Line Chart Data Completeness", () => {
  it("should have exactly one data point per day in the time window", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 0,
          maxLength: 50,
        }),
        timeWindowArb,
        (expenses, timeWindow) => {
          const dateRange = getDateRangeForTimeWindow(timeWindow)
          const lineData = aggregateByDay(expenses, dateRange)
          const expectedDays = getTimeWindowDays(timeWindow)

          return lineData.length === expectedDays
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should show zero for days with no expenses", () => {
    fc.assert(
      fc.property(timeWindowArb, (timeWindow) => {
        // Empty expenses array
        const dateRange = getDateRangeForTimeWindow(timeWindow)
        const lineData = aggregateByDay([], dateRange)

        // All values should be zero
        return lineData.every((item) => item.value === 0)
      }),
      { numRuns: 100 }
    )
  })

  it("should correctly sum expenses for each day", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 6 }), {
          minLength: 1,
          maxLength: 30,
        }),
        (expenses) => {
          const dateRange = getDateRangeForTimeWindow("7d")
          const lineData = aggregateByDay(expenses, dateRange)

          // For each day in line data, verify the sum matches
          for (const dayData of lineData) {
            const dayExpenses = expenses.filter((e) => e.date === dayData.date)
            const expectedSum = dayExpenses.reduce(
              (sum, e) => sum + Math.abs(e.amount),
              0
            )

            if (Math.abs(dayData.value - expectedSum) > 0.01) {
              return false
            }
          }
          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 6: Total Spending Calculation
 * For any set of filtered expenses, the total spending statistic should equal
 * the sum of all expense amounts in the filtered set.
 *
 * Feature: expense-analytics, Property 6: Total Spending Calculation
 * Validates: Requirements 4.1
 */
describe("Property 6: Total Spending Calculation", () => {
  it("should calculate total spending as sum of all expense amounts", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 0,
          maxLength: 50,
        }),
        (expenses) => {
          const stats = calculateStatistics(expenses, 7)
          const expectedTotal = expenses.reduce((sum, e) => sum + Math.abs(e.amount), 0)

          return Math.abs(stats.totalSpending - expectedTotal) < 0.01
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 7: Average Daily Spending Calculation
 * For any set of filtered expenses and time window, the average daily spending
 * should equal the total spending divided by the number of days in the time window.
 *
 * Feature: expense-analytics, Property 7: Average Daily Spending Calculation
 * Validates: Requirements 4.2
 */
describe("Property 7: Average Daily Spending Calculation", () => {
  it("should calculate average daily spending as total divided by days", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 0,
          maxLength: 50,
        }),
        fc.integer({ min: 1, max: 30 }),
        (expenses, daysInPeriod) => {
          const stats = calculateStatistics(expenses, daysInPeriod)
          const expectedAverage = stats.totalSpending / daysInPeriod

          return Math.abs(stats.averageDaily - expectedAverage) < 0.01
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 8: Highest Category Identification
 * For any non-empty set of filtered expenses, the highest spending category
 * should be the category with the maximum total amount, and no other category
 * should have a higher total.
 *
 * Feature: expense-analytics, Property 8: Highest Category Identification
 * Validates: Requirements 4.3
 */
describe("Property 8: Highest Category Identification", () => {
  it("should identify the category with highest total spending", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 1,
          maxLength: 50,
        }),
        (expenses) => {
          const stats = calculateStatistics(expenses, 7)

          if (!stats.highestCategory) {
            return false // Should have a highest category for non-empty expenses
          }

          // Calculate category totals manually
          const categoryTotals = new Map<ExpenseCategory, number>()
          for (const expense of expenses) {
            const current = categoryTotals.get(expense.category) ?? 0
            categoryTotals.set(expense.category, current + Math.abs(expense.amount))
          }

          // Verify no other category has a higher total
          for (const [, amount] of categoryTotals) {
            if (amount > stats.highestCategory.amount + 0.01) {
              return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 9: Highest Day Identification
 * For any non-empty set of filtered expenses, the highest spending day should
 * be the day with the maximum total amount, and no other day should have a higher total.
 *
 * Feature: expense-analytics, Property 9: Highest Day Identification
 * Validates: Requirements 4.4
 */
describe("Property 9: Highest Day Identification", () => {
  it("should identify the day with highest total spending", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 1,
          maxLength: 50,
        }),
        (expenses) => {
          const stats = calculateStatistics(expenses, 7)

          if (!stats.highestDay) {
            return false // Should have a highest day for non-empty expenses
          }

          // Calculate daily totals manually
          const dailyTotals = new Map<string, number>()
          for (const expense of expenses) {
            const current = dailyTotals.get(expense.date) ?? 0
            dailyTotals.set(expense.date, current + Math.abs(expense.amount))
          }

          // Verify no other day has a higher total
          for (const [, amount] of dailyTotals) {
            if (amount > stats.highestDay.amount + 0.01) {
              return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 10: Category Filter Consistency
 * For any category filter selection, all outputs (pie chart, line chart, statistics)
 * should be computed from the same filtered expense set that includes only expenses
 * matching the selected categories.
 *
 * Feature: expense-analytics, Property 10: Category Filter Consistency
 * Validates: Requirements 6.2, 6.3, 6.4
 */
describe("Property 10: Category Filter Consistency", () => {
  it("should filter expenses consistently across all outputs", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 6 }), {
          minLength: 1,
          maxLength: 50,
        }),
        fc.array(categoryArb, { minLength: 0, maxLength: 7 }),
        (expenses, selectedCategories) => {
          // Get unique categories
          const uniqueCategories = [...new Set(selectedCategories)]

          // Filter expenses by categories
          const filteredExpenses = filterExpensesByCategories(expenses, uniqueCategories)

          // Get pie chart data from filtered expenses
          const pieData = aggregateByCategory(filteredExpenses)

          // Get line chart data from filtered expenses
          const dateRange = getDateRangeForTimeWindow("7d")
          const lineData = aggregateByDay(filteredExpenses, dateRange)

          // Get statistics from filtered expenses
          const stats = calculateStatistics(filteredExpenses, 7)

          // Verify pie chart total matches filtered expenses total
          const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0)
          const filteredTotal = filteredExpenses.reduce(
            (sum, e) => sum + Math.abs(e.amount),
            0
          )

          if (Math.abs(pieTotal - filteredTotal) > 0.01) {
            return false
          }

          // Verify statistics total matches filtered expenses total
          if (Math.abs(stats.totalSpending - filteredTotal) > 0.01) {
            return false
          }

          // Verify line chart total matches filtered expenses total
          const lineTotal = lineData.reduce((sum, item) => sum + item.value, 0)
          if (Math.abs(lineTotal - filteredTotal) > 0.01) {
            return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should only include expenses from selected categories", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 1,
          maxLength: 50,
        }),
        fc.array(categoryArb, { minLength: 1, maxLength: 3 }),
        (expenses, selectedCategories) => {
          const uniqueCategories = [...new Set(selectedCategories)]
          const filteredExpenses = filterExpensesByCategories(expenses, uniqueCategories)

          // All filtered expenses should be in selected categories
          return filteredExpenses.every((expense) =>
            uniqueCategories.includes(expense.category)
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 11: Filter Independence
 * For any sequence of time window and category filter changes, changing the time window
 * should not affect the category filter selection, and changing the category filter
 * should not affect the time window selection.
 *
 * Feature: expense-analytics, Property 11: Filter Independence
 * Validates: Requirements 6.6
 */
describe("Property 11: Filter Independence", () => {
  it("should apply time window and category filters independently", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 60 }), {
          minLength: 1,
          maxLength: 50,
        }),
        timeWindowArb,
        fc.array(categoryArb, { minLength: 0, maxLength: 4 }),
        (expenses, timeWindow, selectedCategories) => {
          const uniqueCategories = [...new Set(selectedCategories)]

          // Apply filters in order: time window first, then category
          const timeFiltered = filterExpensesByTimeWindow(expenses, timeWindow)
          const bothFiltered = filterExpensesByCategories(timeFiltered, uniqueCategories)

          // Apply filters in reverse order: category first, then time window
          const categoryFiltered = filterExpensesByCategories(expenses, uniqueCategories)
          const reverseBothFiltered = filterExpensesByTimeWindow(
            categoryFiltered,
            timeWindow
          )

          // Results should be the same regardless of filter order
          // Compare by sorting and checking IDs
          const sortedBoth = [...bothFiltered].sort((a, b) => a.id.localeCompare(b.id))
          const sortedReverse = [...reverseBothFiltered].sort((a, b) =>
            a.id.localeCompare(b.id)
          )

          if (sortedBoth.length !== sortedReverse.length) {
            return false
          }

          for (let i = 0; i < sortedBoth.length; i++) {
            if (sortedBoth[i].id !== sortedReverse[i].id) {
              return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return all expenses when no category filter is applied", () => {
    fc.assert(
      fc.property(
        fc.array(expenseArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 0,
          maxLength: 50,
        }),
        timeWindowArb,
        (expenses, timeWindow) => {
          // Filter by time window only
          const timeFiltered = filterExpensesByTimeWindow(expenses, timeWindow)

          // Apply empty category filter (should return all)
          const withEmptyFilter = filterExpensesByCategories(timeFiltered, [])

          // Results should be identical
          return timeFiltered.length === withEmptyFilter.length
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 12: Payment Method Aggregation
 * For any list of expenses, aggregating by payment method SHALL:
 * - Group expenses without payment method under "Other"
 * - Calculate correct percentages that sum to 100%
 * - Exclude payment method types with zero total amount
 *
 * Feature: payment-method, Property 8: Payment Method Aggregation
 * Validates: Requirements 9.2, 9.3, 9.5
 */
describe("Property 12: Payment Method Aggregation", () => {
  it("should have percentages sum to 100 for non-empty data", () => {
    fc.assert(
      fc.property(
        fc.array(expenseWithPaymentMethodArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 1,
          maxLength: 50,
        }),
        (expenses) => {
          const pieData = aggregateByPaymentMethod(expenses)

          if (pieData.length === 0) {
            return true // Empty data is valid
          }

          const percentageSum = pieData.reduce((sum, item) => sum + item.percentage, 0)

          // Should sum to 100 within tolerance
          return Math.abs(percentageSum - 100) < 0.01
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should exclude payment method types with zero total amount", () => {
    fc.assert(
      fc.property(
        fc.array(expenseWithPaymentMethodArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 0,
          maxLength: 50,
        }),
        (expenses) => {
          const pieData = aggregateByPaymentMethod(expenses)

          // All pie chart items should have value > 0
          return pieData.every((item) => item.value > 0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should group expenses without payment method under 'Other'", () => {
    fc.assert(
      fc.property(
        fc.array(expenseWithPaymentMethodArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 1,
          maxLength: 50,
        }),
        (expenses) => {
          const pieData = aggregateByPaymentMethod(expenses)

          // Calculate expected "Other" total:
          // - Expenses without payment method (undefined)
          // - Expenses with paymentMethod.type === "Other"
          const expectedOtherTotal = expenses
            .filter((e) => !e.paymentMethod || e.paymentMethod.type === "Other")
            .reduce((sum, e) => sum + Math.abs(e.amount), 0)

          // Find "Other" in pie data
          const otherItem = pieData.find((item) => item.paymentMethodType === "Other")

          if (expectedOtherTotal === 0) {
            // If no expenses should be in "Other", it should not be in pie data
            return otherItem === undefined
          } else {
            // If there are expenses that should be in "Other", verify the total matches
            return (
              otherItem !== undefined &&
              Math.abs(otherItem.value - expectedOtherTotal) < 0.01
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should have pie chart total equal to sum of all expense amounts", () => {
    fc.assert(
      fc.property(
        fc.array(expenseWithPaymentMethodArb({ minDaysAgo: 0, maxDaysAgo: 30 }), {
          minLength: 1,
          maxLength: 50,
        }),
        (expenses) => {
          const pieData = aggregateByPaymentMethod(expenses)

          // Sum of pie chart values
          const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0)

          // Sum of all expense amounts (absolute values)
          const expenseTotal = expenses.reduce((sum, e) => sum + Math.abs(e.amount), 0)

          // Should be equal within floating point tolerance
          return Math.abs(pieTotal - expenseTotal) < 0.01
        }
      ),
      { numRuns: 100 }
    )
  })
})
