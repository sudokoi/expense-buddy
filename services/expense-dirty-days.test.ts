import { getItem, clear as clearStorage } from "./storage"

import {
  clearDirtyDays,
  consumeDirtyDays,
  dirtyDaysStorageKeyForTests,
  loadDirtyDays,
  markDeletedDay,
  markDirtyDay,
} from "./expense-dirty-days"

beforeEach(async () => {
  await clearStorage()
})

describe("expense-dirty-days", () => {
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
    const stored = await getItem(key)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.dirtyDays).toEqual([])
    expect(parsed.deletedDays).toEqual([])
  })
})
