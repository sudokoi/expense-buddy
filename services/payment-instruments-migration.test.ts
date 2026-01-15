import AsyncStorage from "@react-native-async-storage/async-storage"

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock("./settings-manager", () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
  markSettingsChanged: jest.fn(),
}))

jest.mock("./change-tracker", () => ({
  trackBulkEdit: jest.fn(),
}))

jest.mock("./payment-instruments", () => {
  const actual = jest.requireActual("./payment-instruments")
  return {
    ...actual,
    generatePaymentInstrumentId: jest.fn(() => "inst_1"),
  }
})

import { migratePaymentInstrumentsOnStartup } from "./payment-instruments-migration"
import { loadSettings, saveSettings, markSettingsChanged } from "./settings-manager"
import { trackBulkEdit } from "./change-tracker"

describe("migratePaymentInstrumentsOnStartup", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"))
    ;(AsyncStorage.getItem as jest.Mock).mockReset()
    ;(AsyncStorage.setItem as jest.Mock).mockReset()
    ;(AsyncStorage.removeItem as jest.Mock).mockReset()
    ;(loadSettings as jest.Mock).mockReset()
    ;(saveSettings as jest.Mock).mockReset()
    ;(markSettingsChanged as jest.Mock).mockReset()
    ;(trackBulkEdit as jest.Mock).mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("initial migration: creates instrument from legacy identifier and links expenses", async () => {
    ;(loadSettings as jest.Mock).mockResolvedValue({
      syncSettings: true,
      paymentInstruments: [],
      paymentInstrumentsMigrationVersion: 0,
      version: 5,
    })

    const expenses = [
      {
        id: "e1",
        amount: 100,
        category: "Food",
        date: "2025-01-01",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        paymentMethod: {
          type: "Credit Card",
          identifier: "12-34",
        },
      },
      {
        id: "e2",
        amount: 50,
        category: "Food",
        date: "2025-01-01",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        paymentMethod: {
          type: "Credit Card",
          identifier: "1234",
        },
      },
    ]

    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "expenses:index:v1") return Promise.resolve(null)
      if (key === "expenses") return Promise.resolve(JSON.stringify(expenses))
      return Promise.resolve(null)
    })

    await migratePaymentInstrumentsOnStartup()

    expect(saveSettings).toHaveBeenCalledTimes(1)
    const savedSettings = (saveSettings as jest.Mock).mock.calls[0][0]
    expect(savedSettings.paymentInstruments).toHaveLength(1)
    expect(savedSettings.paymentInstruments[0]).toMatchObject({
      id: "inst_1",
      method: "Credit Card",
      lastDigits: "1234",
    })
    expect(savedSettings.paymentInstrumentsMigrationVersion).toBe(1)

    // Persisted as v1: index + per-item keys
    const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls

    // index write
    const indexCall = setItemCalls.find((c) => c[0] === "expenses:index:v1")
    expect(indexCall).toBeTruthy()
    const updatedIds = JSON.parse(indexCall![1])
    expect(updatedIds).toEqual(["e1", "e2"])

    const e1Call = setItemCalls.find((c) => c[0] === "expenses:item:v1:e1")
    const e2Call = setItemCalls.find((c) => c[0] === "expenses:item:v1:e2")
    expect(e1Call).toBeTruthy()
    expect(e2Call).toBeTruthy()

    const updatedE1 = JSON.parse(e1Call![1])
    const updatedE2 = JSON.parse(e2Call![1])

    for (const e of [updatedE1, updatedE2]) {
      expect(e.paymentMethod.instrumentId).toBe("inst_1")
      expect(e.paymentMethod.identifier).toBe("1234")
    }

    expect(trackBulkEdit).toHaveBeenCalledTimes(1)
    expect(markSettingsChanged).toHaveBeenCalledTimes(1)
  })

  test("initial migration: does not mark settings changed when syncSettings is false", async () => {
    ;(loadSettings as jest.Mock).mockResolvedValue({
      syncSettings: false,
      paymentInstruments: [],
      paymentInstrumentsMigrationVersion: 0,
      version: 5,
    })

    const expenses = [
      {
        id: "e1",
        amount: 100,
        category: "Food",
        date: "2025-01-01",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        paymentMethod: {
          type: "UPI",
          identifier: "x1y2z3",
        },
      },
    ]

    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "expenses:index:v1") return Promise.resolve(null)
      if (key === "expenses") return Promise.resolve(JSON.stringify(expenses))
      return Promise.resolve(null)
    })

    await migratePaymentInstrumentsOnStartup()

    expect(saveSettings).toHaveBeenCalledTimes(1)
    expect(markSettingsChanged).not.toHaveBeenCalled()
  })

  test("relink pass: attaches instrumentId when instrument exists and expense is missing instrumentId", async () => {
    ;(loadSettings as jest.Mock).mockResolvedValue({
      syncSettings: true,
      paymentInstrumentsMigrationVersion: 1,
      paymentInstruments: [
        {
          id: "inst_1",
          method: "Debit Card",
          nickname: "Debit 7777",
          lastDigits: "7777",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      version: 5,
    })

    const expenses = [
      {
        id: "e1",
        amount: 1,
        category: "Food",
        date: "2025-01-01",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        paymentMethod: {
          type: "Debit Card",
          identifier: "7777",
        },
      },
    ]

    ;(AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "expenses:index:v1") return Promise.resolve(null)
      if (key === "expenses") return Promise.resolve(JSON.stringify(expenses))
      return Promise.resolve(null)
    })

    await migratePaymentInstrumentsOnStartup()

    // In relink pass it should only write expenses and track bulk edit
    expect(saveSettings).not.toHaveBeenCalled()

    const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls
    const updatedExpenseCall = setItemCalls.find((c) => c[0] === "expenses:item:v1:e1")
    expect(updatedExpenseCall).toBeTruthy()
    const updated = JSON.parse(updatedExpenseCall![1])
    expect(updated.paymentMethod.instrumentId).toBe("inst_1")

    expect(trackBulkEdit).toHaveBeenCalledTimes(1)
    expect(markSettingsChanged).not.toHaveBeenCalled()
  })
})
