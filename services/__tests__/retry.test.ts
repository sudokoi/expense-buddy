import { withRetry, pMap, isRetryableFetchError } from "../retry"

describe("withRetry", () => {
  it("resolves on first attempt when fn succeeds", async () => {
    const fn = jest.fn().mockResolvedValue("ok")
    await expect(withRetry(fn)).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on network errors and eventually succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockResolvedValue("ok")

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(3)
  }, 10000)

  it("retries on 429 status and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue("ok")

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(3)
  }, 10000)

  it("retries on 5xx status and succeeds", async () => {
    const fn = jest.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValue("ok")

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(2)
  }, 10000)

  it("does not retry on 401 status", async () => {
    const fn = jest.fn().mockRejectedValue({ status: 401 })
    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual({ status: 401 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("does not retry on 404 status", async () => {
    const fn = jest.fn().mockRejectedValue({ status: 404 })
    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual({ status: 404 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("exhausts retries and throws final error", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("Failed to fetch"))

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow(
      "Failed to fetch"
    )
    expect(fn).toHaveBeenCalledTimes(3)
  }, 10000)

  it("uses maxDelayMs cap for exponential backoff", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValue("ok")

    await expect(
      withRetry(fn, { maxRetries: 5, baseDelayMs: 1, maxDelayMs: 2 })
    ).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(5)
  }, 10000)
})

describe("pMap", () => {
  it("maps items in parallel with concurrency limit", async () => {
    const mapper = jest.fn(async (x: number) => x * 2)
    const result = await pMap([1, 2, 3, 4], mapper, 2)
    expect(result).toEqual([2, 4, 6, 8])
    expect(mapper).toHaveBeenCalledTimes(4)
  })

  it("preserves order with concurrent execution", async () => {
    const result = await pMap(
      [1, 2, 3],
      async (x) => {
        await Promise.resolve()
        return x * 2
      },
      3
    )
    expect(result).toEqual([2, 4, 6])
  })

  it("handles empty input", async () => {
    const result = await pMap([], async (x: number) => x)
    expect(result).toEqual([])
  })

  it("handles single item", async () => {
    const result = await pMap([42], async (x: number) => x * 2)
    expect(result).toEqual([84])
  })

  it("throws when mapper throws", async () => {
    const error = new Error("mapper failed")
    await expect(pMap([1], jest.fn().mockRejectedValue(error))).rejects.toThrow(
      "mapper failed"
    )
  })
})

describe("isRetryableFetchError", () => {
  it("returns true for 429 (rate limit)", () => {
    expect(isRetryableFetchError({ status: 429 })).toBe(true)
  })

  it("returns true for 409 (conflict)", () => {
    expect(isRetryableFetchError({ status: 409 })).toBe(true)
  })

  it("returns true for 5xx errors", () => {
    expect(isRetryableFetchError({ status: 500 })).toBe(true)
    expect(isRetryableFetchError({ status: 502 })).toBe(true)
    expect(isRetryableFetchError({ status: 503 })).toBe(true)
  })

  it("returns false for 401 and 404", () => {
    expect(isRetryableFetchError({ status: 401 })).toBe(false)
    expect(isRetryableFetchError({ status: 404 })).toBe(false)
  })

  it("returns false for 422 (validation error)", () => {
    expect(isRetryableFetchError({ status: 422 })).toBe(false)
  })
})
