export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableHttpError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status
    if (status === 401 || status === 403 || status === 404 || status === 422) {
      return false
    }
    return status >= 500 || status === 429
  }

  const msg = String(error)
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("Network request failed") ||
    msg.includes("TypeError") ||
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET")
  )
}

function isRetryableStatus(status: number): boolean {
  if (status === 429) return true
  if (status >= 500 && status <= 599) return true
  if (status === 409) return true
  return false
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt < maxRetries && isRetryableHttpError(error)) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
        const jitter = delay * 0.25 * Math.random()
        await sleep(delay + jitter)
      } else {
        throw error
      }
    }
  }

  throw lastError
}

export function isRetryableFetchError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>
    if (typeof err.status === "number" && isRetryableStatus(err.status)) {
      return true
    }
  }
  return isRetryableHttpError(error)
}

export async function pMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []
  const queue = items.entries()

  const worker = async () => {
    for (const [index, item] of queue) {
      results[index] = await mapper(item, index)
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker())

  await Promise.all(workers)
  return results
}
