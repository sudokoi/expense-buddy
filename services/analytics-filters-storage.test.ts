// Mock AsyncStorage before importing the module under test
const mockStorage: Map<string, string> = new Map()

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
}))

import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  DEFAULT_ANALYTICS_FILTERS,
  analyticsFiltersStorageKeyForTests,
  loadAnalyticsFilters,
  saveAnalyticsFilters,
} from "./analytics-filters-storage"

describe("analytics-filters-storage", () => {
  beforeEach(() => {
    mockStorage.clear()
    ;(AsyncStorage.getItem as jest.Mock).mockClear()
    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    ;(AsyncStorage.removeItem as jest.Mock).mockClear()
  })

  it("loadAnalyticsFilters SHALL return defaults when storage empty", async () => {
    await expect(loadAnalyticsFilters()).resolves.toEqual(DEFAULT_ANALYTICS_FILTERS)
  })

  it("loadAnalyticsFilters SHALL return defaults when JSON is invalid", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    mockStorage.set(analyticsFiltersStorageKeyForTests(), "{not-json")

    await expect(loadAnalyticsFilters()).resolves.toEqual(DEFAULT_ANALYTICS_FILTERS)
    warnSpy.mockRestore()
  })

  it("saveAnalyticsFilters SHALL store normalized JSON", async () => {
    await saveAnalyticsFilters({
      timeWindow: "1m",
      selectedMonth: null,
      selectedCategories: ["Food"],
      selectedPaymentMethods: [],
      // Should be normalized to [] when payment methods are "All"
      selectedPaymentInstruments: ["UPI::__others__"],
      selectedCurrency: "USD",
      searchQuery: "lunch",
      minAmount: 100,
      maxAmount: 500,
    })

    const key = analyticsFiltersStorageKeyForTests()
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1)
    expect((AsyncStorage.setItem as jest.Mock).mock.calls[0][0]).toBe(key)

    const storedJson = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
    expect(JSON.parse(storedJson)).toEqual({
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

    mockStorage.set(analyticsFiltersStorageKeyForTests(), JSON.stringify(stored))

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

    mockStorage.set(analyticsFiltersStorageKeyForTests(), JSON.stringify(stored))

    await expect(loadAnalyticsFilters()).resolves.toEqual({
      ...DEFAULT_ANALYTICS_FILTERS,
      timeWindow: "6m",
    })
  })
})
