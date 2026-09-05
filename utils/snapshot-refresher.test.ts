import { createSnapshotRefresher } from "./snapshot-refresher"

test("a failed load does not prevent a later refresh", async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(2)
  const publish = jest.fn()
  const onError = jest.fn()
  const refresher = createSnapshotRefresher({
    load,
    publish,
    onError,
    loading: jest.fn(),
  })
  await refresher.refresh()
  await refresher.refresh()
  expect(onError).toHaveBeenCalledTimes(1)
  expect(publish).toHaveBeenCalledWith(2)
})

test("coalesces a burst and retains invalidation during an in-flight read", async () => {
  let complete!: (value: number) => void
  const load = jest.fn(
    () =>
      new Promise<number>((resolve) => {
        complete = resolve
      })
  )
  const publish = jest.fn()
  const refresher = createSnapshotRefresher({
    load,
    publish,
    loading: jest.fn(),
    onError: jest.fn(),
  })
  const first = refresher.refresh()
  refresher.refresh()
  await Promise.resolve()
  expect(load).toHaveBeenCalledTimes(1)
  const trailing = refresher.refresh()
  complete(1)
  await Promise.resolve()
  expect(load).toHaveBeenCalledTimes(2)
  complete(2)
  await Promise.all([first, trailing])
  expect(publish.mock.calls).toEqual([[1], [2]])
})

test("disposal prevents late publication and further reads", async () => {
  let complete!: (value: number) => void
  const publish = jest.fn()
  const load = jest.fn(
    () =>
      new Promise<number>((resolve) => {
        complete = resolve
      })
  )
  const refresher = createSnapshotRefresher({
    load,
    publish,
    loading: jest.fn(),
    onError: jest.fn(),
  })
  const done = refresher.refresh()
  await Promise.resolve()
  refresher.dispose()
  complete(1)
  await done
  await refresher.refresh()
  expect(publish).not.toHaveBeenCalled()
  expect(load).toHaveBeenCalledTimes(1)
})
