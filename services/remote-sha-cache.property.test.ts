import * as fc from "fast-check"

import { clear, setItem } from "./storage"
import {
  loadRemoteSHACache,
  saveRemoteSHACache,
  clearRemoteSHACache,
} from "./remote-sha-cache"

describe("Property 2: SHA Cache Round-Trip Persistence", () => {
  beforeEach(async () => {
    await clear()
  })

  const shaArb = fc.stringMatching(/^[0-9a-f]{40}$/)
  const shaCacheArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("\0")),
    shaArb
  )

  it("saving and loading SHALL produce an identical map", async () => {
    await fc.assert(
      fc.asyncProperty(shaCacheArb, async (cache) => {
        await clear()
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
        await clear()
        await saveRemoteSHACache(cache)
        await clearRemoteSHACache()
        const loaded = await loadRemoteSHACache()
        expect(loaded).toEqual({})
      }),
      { numRuns: 100 }
    )
  })

  it("corrupted JSON SHALL be handled gracefully by returning empty map", async () => {
    await setItem("remote_sha_cache", "not valid json {{{")
    const loaded = await loadRemoteSHACache()
    expect(loaded).toEqual({})
  })
})
