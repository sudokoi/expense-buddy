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
  clearDirtyDays,
  consumeDirtyDays,
  dirtyDaysStorageKeyForTests,
  loadDirtyDays,
  markDeletedDay,
  markDirtyDay,
} from "./expense-dirty-days"

describe("expense-dirty-days", () => {
  beforeEach(() => {
    mockStorage.clear()
    ;(AsyncStorage.getItem as jest.Mock).mockClear()
    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    ;(AsyncStorage.removeItem as jest.Mock).mockClear()
  })

  it("loadDirtyDays SHALL return empty untrusted state when storage empty", async () => {
    const result = await loadDirtyDays()

    expect(result.isTrusted).toBe(false)
    expect(result.state.dirtyDays).toEqual([])
    expect(result.state.deletedDays).toEqual([])
  })

  it("markDirtyDay SHALL persist the day key", async () => {
    await markDirtyDay("2025-01-01")
    const result = await loadDirtyDays()

    expect(result.isTrusted).toBe(true)
    expect(result.state.dirtyDays).toEqual(["2025-01-01"])
    expect(result.state.deletedDays).toEqual([])
  })

  it("markDeletedDay SHALL add to dirty and deleted sets", async () => {
    await markDeletedDay("2025-01-02")
    const result = await loadDirtyDays()

    expect(result.state.dirtyDays).toEqual(["2025-01-02"])
    expect(result.state.deletedDays).toEqual(["2025-01-02"])
  })

  it("clearDirtyDays SHALL remove stored state", async () => {
    await markDirtyDay("2025-01-03")
    await clearDirtyDays()

    const result = await loadDirtyDays()
    expect(result.isTrusted).toBe(true)
    expect(result.state.dirtyDays).toEqual([])
    expect(result.state.deletedDays).toEqual([])
  })

  it("consumeDirtyDays SHALL return state and clear storage", async () => {
    await markDirtyDay("2025-01-04")
    const consumed = await consumeDirtyDays()

    expect(consumed.state.dirtyDays).toEqual(["2025-01-04"])

    const key = dirtyDaysStorageKeyForTests()
    const stored = mockStorage.get(key)
    expect(stored).not.toBeUndefined()
    const parsed = JSON.parse(stored!)
    expect(parsed.dirtyDays).toEqual([])
    expect(parsed.deletedDays).toEqual([])
  })
})
