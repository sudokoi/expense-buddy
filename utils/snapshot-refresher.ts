/** Coalesces invalidations without losing the one that arrives during a read. */
export function createSnapshotRefresher<T>(options: {
  load: () => Promise<T>
  publish: (value: T) => void
  loading: (value: boolean) => void
  onError: (error: unknown) => void
}) {
  let pending = false
  let disposed = false
  let active: Promise<void> | null = null

  async function drain() {
    options.loading(true)
    try {
      while (pending && !disposed) {
        pending = false
        try {
          const value = await options.load()
          if (!disposed) options.publish(value)
        } catch (error) {
          if (!disposed) options.onError(error)
        }
      }
    } finally {
      active = null
      if (!disposed) options.loading(false)
    }
  }

  return {
    refresh(): Promise<void> {
      if (disposed) return Promise.resolve()
      pending = true
      if (!active) active = Promise.resolve().then(drain)
      return active
    },
    dispose() {
      disposed = true
      pending = false
    },
  }
}
