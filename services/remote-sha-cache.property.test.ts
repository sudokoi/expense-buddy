/**
 * Property-based tests for Remote SHA Cache
 * Feature: sync-engine-optimization
 */

import * as fc from "fast-check"

// Mock AsyncStorage before imports
const mockStorage = new Map<string, string>()

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value)
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key)
  }),
}))

import {
  loadRemoteSHACache,
  saveRemoteSHACache,
  clearRemoteSHACache,
} from "./remote-sha-cache"

/**
 * Property 2: SHA Cache Round-Trip Persistence
 * For any map of filenames to SHA strings, saving and loading SHALL produce
 * an identical map.
 */
describe("Property 2: SHA Cache Round-Trip Persistence", () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  // Arbitrary for generating filename → SHA maps
  const shaArb = fc.stringMatching(/^[0-9a-f]{40}$/)
  const shaCacheArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("\0")),
    shaArb
  )

  it("saving and loading SHALL produce an identical map", async () => {
    await fc.assert(
      fc.asyncProperty(shaCacheArb, async (cache) => {
        mockStorage.clear()
        await saveRemoteSHACache(cache)
        const loaded = await loadRemoteSHACache()
        expect(loaded).toEqual(cache)
      }),
      { numRuns: 100 }
    )
  })

  it("loading from empty storage SHALL return an empty map", async () => {
    const loaded = await loadRemoteSHACache()
    expect(loaded).toEqual({})
  })

  it("clearing SHALL cause subsequent load to return an empty map", async () => {
    await fc.assert(
      fc.asyncProperty(shaCacheArb, async (cache) => {
        mockStorage.clear()
        await saveRemoteSHACache(cache)
        await clearRemoteSHACache()
        const loaded = await loadRemoteSHACache()
        expect(loaded).toEqual({})
      }),
      { numRuns: 100 }
    )
  })

  it("corrupted JSON SHALL be handled gracefully by returning empty map", async () => {
    mockStorage.set("remote_sha_cache", "not valid json {{{")
    const loaded = await loadRemoteSHACache()
    expect(loaded).toEqual({})
  })
})
