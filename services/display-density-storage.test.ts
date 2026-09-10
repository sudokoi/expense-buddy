import {
  loadDisplayDensity,
  loadDisplayDensitySync,
  saveDisplayDensity,
} from "./display-density-storage"
import { getItem, getItemSync, setItem } from "./storage"

jest.mock("./storage", () => ({
  getItem: jest.fn(),
  getItemSync: jest.fn(),
  setItem: jest.fn(),
}))

beforeEach(() => jest.clearAllMocks())

it.each([null, undefined, "large", "", 1])(
  "defaults invalid local density %p to Standard",
  async (value) => {
    jest.mocked(getItem).mockResolvedValue(value as string | null)
    jest.mocked(getItemSync).mockReturnValue(value as string | null)
    expect(await loadDisplayDensity()).toBe("standard")
    expect(loadDisplayDensitySync()).toBe("standard")
  }
)

it("hydrates the same device-local preference synchronously and asynchronously", async () => {
  jest.mocked(getItem).mockResolvedValue("compact")
  jest.mocked(getItemSync).mockReturnValue("compact")
  expect(loadDisplayDensitySync()).toBe("compact")
  expect(await loadDisplayDensity()).toBe("compact")
  expect(getItem).toHaveBeenCalledWith("display_density_v1")
})

it("serializes rapid selections instead of letting a slower old write win", async () => {
  let finish!: () => void
  jest
    .mocked(setItem)
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    .mockResolvedValue(undefined)
  const first = saveDisplayDensity("compact")
  const last = saveDisplayDensity("standard")
  await Promise.resolve()
  expect(setItem).toHaveBeenCalledTimes(1)
  finish()
  await Promise.all([first, last])
  expect(jest.mocked(setItem).mock.calls).toEqual([
    ["display_density_v1", "compact"],
    ["display_density_v1", "standard"],
  ])
})

it("allows the next selection to persist after a failed write", async () => {
  jest
    .mocked(setItem)
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValue(undefined)
  await expect(saveDisplayDensity("compact")).rejects.toThrow("unavailable")
  await expect(saveDisplayDensity("standard")).resolves.toBeUndefined()
})
