import { createAppDialogQueue } from "./app-dialog-queue"

const flushActions = () => new Promise<void>((resolve) => setImmediate(resolve))

describe("app confirmation queue", () => {
  const owner = Symbol("screen")
  let onError: jest.Mock
  let queue: ReturnType<typeof createAppDialogQueue>

  beforeEach(() => {
    onError = jest.fn()
    queue = createAppDialogQueue(onError)
  })

  it("runs the chosen destructive action once, even on repeated taps", async () => {
    const remove = jest.fn()
    const cancel = jest.fn()
    const id = queue.show(owner, "Delete?", "Cannot undo", [
      { text: "Cancel", style: "cancel", onPress: cancel },
      { text: "Delete", style: "destructive", onPress: remove },
    ])
    queue.choose(id, 1)
    queue.choose(id, 1)
    queue.dismiss(id)
    expect(queue.getSnapshot()).toBeNull()
    await flushActions()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(cancel).not.toHaveBeenCalled()
  })

  it("treats Back/escape as cancellation, including promise-based sync conflicts", async () => {
    const resolve = jest.fn()
    const id = queue.show(owner, "Conflict", "Choose a version", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(undefined) },
      { text: "Local", onPress: () => resolve("local") },
      { text: "Remote", onPress: () => resolve("remote") },
    ])
    queue.dismiss(id)
    await flushActions()
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith(undefined)
  })

  it.each([1, 2])("preserves conflict choice %i", async (index) => {
    const resolve = jest.fn()
    const id = queue.show(owner, "Conflict", "Choose", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(undefined) },
      { text: "Local", onPress: () => resolve("local") },
      { text: "Remote", onPress: () => resolve("remote") },
    ])
    queue.choose(id, index)
    await flushActions()
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledWith(index === 1 ? "local" : "remote")
  })

  it("does not run an affirmative action when a dialog has no cancel callback", async () => {
    const action = jest.fn()
    const id = queue.show(owner, "Notice", "Message", [{ text: "OK", onPress: action }])
    queue.dismiss(id)
    await flushActions()
    expect(action).not.toHaveBeenCalled()
  })

  it("queues concurrent prompts and rejects stale or hidden-dialog actions", async () => {
    const first = jest.fn()
    const second = jest.fn()
    const firstId = queue.show(owner, "First", "", [{ text: "Go", onPress: first }])
    const secondId = queue.show(owner, "Second", "", [{ text: "Go", onPress: second }])
    queue.choose(secondId, 0)
    expect(queue.getSnapshot()?.id).toBe(firstId)
    queue.choose(firstId, 99)
    expect(queue.getSnapshot()?.id).toBe(firstId)
    queue.choose(firstId, 0)
    expect(queue.getSnapshot()?.id).toBe(secondId)
    queue.choose(firstId, 0)
    queue.choose(secondId, 0)
    await flushActions()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("cancels all prompts owned by an unmounted caller, but not another screen's", async () => {
    const cancel = jest.fn()
    const otherOwner = Symbol("other-screen")
    queue.show(owner, "First", "", [{ text: "Cancel", style: "cancel", onPress: cancel }])
    const otherId = queue.show(otherOwner, "Other", "", [{ text: "OK" }])
    queue.show(owner, "Queued", "", [
      { text: "Cancel", style: "cancel", onPress: cancel },
    ])
    queue.cancelOwner(owner)
    queue.cancelOwner(owner)
    await flushActions()
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(queue.getSnapshot()?.id).toBe(otherId)
  })

  it.each(["throw", "reject"])(
    "reports an action %s without blocking the queue",
    async (mode) => {
      const error = new Error("Failed")
      const id = queue.show(owner, "Action", "", [
        {
          text: "Run",
          onPress: () => {
            if (mode === "throw") throw error
            return Promise.reject(error)
          },
        },
      ])
      queue.choose(id, 0)
      await flushActions()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(error)
      expect(queue.getSnapshot()).toBeNull()
    }
  )

  it("publishes stable snapshots and unsubscribes cleanly", () => {
    const listener = jest.fn()
    const unsubscribe = queue.subscribe(listener)
    const id = queue.show(owner, "Title", "Message", [
      { text: "Cancel", style: "cancel" },
    ])
    expect(queue.getSnapshot()).toBe(queue.getSnapshot())
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    queue.dismiss(id)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
