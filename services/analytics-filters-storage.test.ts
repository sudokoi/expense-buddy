import { getItem, setItem, clear } from "./storage"

import {
  DEFAULT_ANALYTICS_FILTERS,
  analyticsFiltersStorageKeyForTests,
  loadAnalyticsFilters,
  saveAnalyticsFilters,
} from "./analytics-filters-storage"

describe("analytics-filters-storage", () => {
  beforeEach(async () => {
    await clear()
  })

  it("loadAnalyticsFilters SHALL return defaults when storage empty", async () => {
    await expect(loadAnalyticsFilters()).resolves.toEqual(DEFAULT_ANALYTICS_FILTERS)
  })

  it("loadAnalyticsFilters SHALL return defaults when JSON is invalid", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    await setItem(analyticsFiltersStorageKeyForTests(), "{not-json")

    await expect(loadAnalyticsFilters()).resolves.toEqual(DEFAULT_ANALYTICS_FILTERS)
    warnSpy.mockRestore()
  })

  it("saveAnalyticsFilters SHALL store normalized JSON", async () => {
    await saveAnalyticsFilters({
      timeWindow: "1m",
      selectedMonth: null,
      selectedCategories: ["Food"],
      selectedPaymentMethods: [],
      selectedPaymentInstruments: ["UPI::__others__"],
      selectedCurrency: "USD",
      searchQuery: "lunch",
      minAmount: 100,
      maxAmount: 500,
    })

    const key = analyticsFiltersStorageKeyForTests()
    const stored = await getItem(key)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toEqual({
      timeWindow: "1m",
      selectedMonth: null,
      selectedCategories: ["Food"],
      selectedPaymentMethods: [],
      selectedPaymentInstruments: [],
      selectedCurrency: "USD",
      searchQuery: "lunch",
      minAmount: 100,
      maxAmount: 500,
    })
  })

  it("loadAnalyticsFilters SHALL roundtrip saved filters", async () => {
    const stored = {
      timeWindow: "6m",
      selectedMonth: "2025-11",
      selectedCategories: ["Food", "Travel"],
      selectedPaymentMethods: ["Cash"],
      selectedPaymentInstruments: ["Credit Card::__others__"],
      selectedCurrency: "EUR",
      searchQuery: "dinner",
      minAmount: 50,
      maxAmount: 200,
    }

    await setItem(analyticsFiltersStorageKeyForTests(), JSON.stringify(stored))

    await expect(loadAnalyticsFilters()).resolves.toEqual({
      ...stored,
      timeWindow: "all",
    })
  })

  it("loadAnalyticsFilters SHALL clear month when invalid", async () => {
    const stored = {
      timeWindow: "6m",
      selectedMonth: "invalid",
      selectedCategories: [],
      selectedPaymentMethods: [],
      selectedPaymentInstruments: [],
      selectedCurrency: null,
      searchQuery: "",
      minAmount: null,
      maxAmount: null,
    }

    await setItem(analyticsFiltersStorageKeyForTests(), JSON.stringify(stored))

    await expect(loadAnalyticsFilters()).resolves.toEqual({
      ...DEFAULT_ANALYTICS_FILTERS,
      timeWindow: "6m",
    })
  })
})
