/**
 * Tests for the AsyncStorage -> MMKV migration in services/storage.ts.
 *
 * These override the global mocks from jest-setup.ts with controllable
 * in-memory implementations so we can exercise the real migration logic:
 * seeding AsyncStorage, injecting failures, and asserting that no data is
 * lost on update.
 */

const MIGRATED_KEY = "_migrated_from_async_storage"

// Shared, controllable mock state (names must start with "mock" for jest hoisting).
const mockAsyncStore = new Map<string, string>()
const mockMmkvStore = new Map<string, string | boolean>()
const mockCtl = {
  failAsyncGetAllKeys: false,
  failMmkvSet: false,
  getAllKeysCalls: 0,
}

jest.mock("@react-native-async-storage/async-storage", () => ({
  getAllKeys: jest.fn(async () => {
    mockCtl.getAllKeysCalls++
    if (mockCtl.failAsyncGetAllKeys) throw new Error("getAllKeys failed")
    return Array.from(mockAsyncStore.keys())
  }),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map((k) => [k, mockAsyncStore.has(k) ? mockAsyncStore.get(k)! : null])
  ),
  clear: jest.fn(async () => {
    mockAsyncStore.clear()
  }),
  getItem: jest.fn(async (k: string) =>
    mockAsyncStore.has(k) ? mockAsyncStore.get(k)! : null
  ),
  setItem: jest.fn(async (k: string, v: string) => {
    mockAsyncStore.set(k, v)
  }),
  removeItem: jest.fn(async (k: string) => {
    mockAsyncStore.delete(k)
  }),
  multiSet: jest.fn(async (pairs: [string, string][]) => {
    for (const [k, v] of pairs) mockAsyncStore.set(k, v)
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    for (const k of keys) mockAsyncStore.delete(k)
  }),
}))

jest.mock("react-native-mmkv", () => ({
  createMMKV: jest.fn(() => ({
    getString: (k: string) => {
      const v = mockMmkvStore.get(k)
      return typeof v === "string" ? v : undefined
    },
    set: (k: string, v: string | boolean) => {
      if (mockCtl.failMmkvSet) throw new Error("mmkv set failed")
      mockMmkvStore.set(k, v)
    },
    getBoolean: (k: string) => {
      const v = mockMmkvStore.get(k)
      return typeof v === "boolean" ? v : false
    },
    remove: (k: string) => {
      mockMmkvStore.delete(k)
    },
    getAllKeys: () => Array.from(mockMmkvStore.keys()),
    clearAll: () => {
      mockMmkvStore.clear()
    },
  })),
}))

type StorageModule = typeof import("./storage")

function loadStorage(): StorageModule {
  // storage.ts has module-level state (migrated flag, mmkv instance); a fresh
  // require simulates a fresh app launch.
  return require("./storage") as StorageModule
}

beforeEach(() => {
  mockAsyncStore.clear()
  mockMmkvStore.clear()
  mockCtl.failAsyncGetAllKeys = false
  mockCtl.failMmkvSet = false
  mockCtl.getAllKeysCalls = 0
  jest.resetModules()
})

describe("storage migration (AsyncStorage -> MMKV)", () => {
  it("copies all AsyncStorage keys into MMKV and clears AsyncStorage", async () => {
    mockAsyncStore.set("expenses:index:v1", JSON.stringify(["a", "b"]))
    mockAsyncStore.set("expenses:item:v1:a", JSON.stringify({ id: "a", amount: 10 }))
    mockAsyncStore.set("settings", JSON.stringify({ theme: "dark" }))
    mockAsyncStore.set("remote_sha_cache", "deadbeef")

    const storage = loadStorage()

    // First read triggers migration and returns the migrated value.
    await expect(storage.getItem("settings")).resolves.toBe(
      JSON.stringify({ theme: "dark" })
    )

    // Every key landed in MMKV.
    expect(mockMmkvStore.get("expenses:index:v1")).toBe(JSON.stringify(["a", "b"]))
    expect(mockMmkvStore.get("expenses:item:v1:a")).toBe(
      JSON.stringify({ id: "a", amount: 10 })
    )
    expect(mockMmkvStore.get("remote_sha_cache")).toBe("deadbeef")

    // Migration flag set and AsyncStorage cleared.
    expect(mockMmkvStore.get(MIGRATED_KEY)).toBe(true)
    expect(mockAsyncStore.size).toBe(0)
  })

  it("does not re-migrate (or read AsyncStorage) once the flag is set", async () => {
    mockMmkvStore.set(MIGRATED_KEY, true)
    mockMmkvStore.set("settings", "from-mmkv")
    // Stale leftover that must be ignored, not resurrected.
    mockAsyncStore.set("settings", "stale-async")

    const storage = loadStorage()

    await expect(storage.getItem("settings")).resolves.toBe("from-mmkv")
    expect(mockCtl.getAllKeysCalls).toBe(0)
    // AsyncStorage untouched (migration skipped).
    expect(mockAsyncStore.get("settings")).toBe("stale-async")
  })

  it("preserves data and retries when migration fails, then succeeds next attempt", async () => {
    mockAsyncStore.set("settings", "keep-me")
    mockCtl.failAsyncGetAllKeys = true

    const storage = loadStorage()

    // Migration fails but must NOT throw to the caller.
    await expect(storage.getItem("settings")).resolves.toBeNull()
    // Original data intact, flag not set.
    expect(mockAsyncStore.get("settings")).toBe("keep-me")
    expect(mockMmkvStore.has(MIGRATED_KEY)).toBe(false)

    // Transient failure clears; a subsequent call retries and succeeds.
    mockCtl.failAsyncGetAllKeys = false
    await expect(storage.getItem("settings")).resolves.toBe("keep-me")
    expect(mockMmkvStore.get("settings")).toBe("keep-me")
    expect(mockMmkvStore.get(MIGRATED_KEY)).toBe(true)
    expect(mockAsyncStore.size).toBe(0)
  })

  it("does not clear AsyncStorage when a copy fails midway", async () => {
    mockAsyncStore.set("settings", "keep-me")
    mockCtl.failMmkvSet = true

    const storage = loadStorage()

    await expect(storage.getItem("settings")).resolves.toBeNull()
    // clear() must not have run, so original data is still recoverable.
    expect(mockAsyncStore.get("settings")).toBe("keep-me")
    expect(mockMmkvStore.has(MIGRATED_KEY)).toBe(false)
  })

  it("getAllKeys excludes the internal migration flag", async () => {
    mockAsyncStore.set("a", "1")
    mockAsyncStore.set("b", "2")

    const storage = loadStorage()

    const keys = await storage.getAllKeys()
    expect(keys.sort()).toEqual(["a", "b"])
    expect(keys).not.toContain(MIGRATED_KEY)
  })

  it("clear() before any read migrates first and does not resurrect data", async () => {
    mockAsyncStore.set("settings", "keep-me")

    const storage = loadStorage()
    await storage.clear()

    // Both stores empty; nothing to resurrect on the next read.
    expect(mockAsyncStore.size).toBe(0)
    await expect(storage.getItem("settings")).resolves.toBeNull()

    // Simulate a fresh launch: still empty (AsyncStorage was cleared).
    jest.resetModules()
    const storageNext = loadStorage()
    await expect(storageNext.getItem("settings")).resolves.toBeNull()
  })

  it("runs migration only once for concurrent first reads", async () => {
    mockAsyncStore.set("settings", "v")

    const storage = loadStorage()

    const [a, b] = await Promise.all([
      storage.getItem("settings"),
      storage.getItem("settings"),
    ])

    expect(a).toBe("v")
    expect(b).toBe("v")
    expect(mockCtl.getAllKeysCalls).toBe(1)
  })
})
