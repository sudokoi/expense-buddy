import { uiStateStore, initializeUIStateStore } from "./ui-state-store"
import {
  loadDisplayDensity,
  saveDisplayDensity,
} from "../services/display-density-storage"

jest.mock("../services/display-density-storage", () => ({
  loadDisplayDensitySync: () => "standard",
  loadDisplayDensity: jest.fn(),
  saveDisplayDensity: jest.fn().mockResolvedValue(undefined),
}))

it("ignores late hydration after a user choice and preserves existing UI preferences", async () => {
  let resolve!: (value: "standard" | "compact") => void
  jest.mocked(loadDisplayDensity).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const initialize = initializeUIStateStore()
  uiStateStore.trigger.setDisplayDensity({ density: "compact" })
  uiStateStore.trigger.setPaymentMethodExpanded({ expanded: true })
  resolve("standard")
  await initialize
  expect(uiStateStore.getSnapshot().context.displayDensity).toBe("compact")
  expect(uiStateStore.getSnapshot().context.densityHydrated).toBe(true)
  expect(saveDisplayDensity).toHaveBeenCalledWith("compact")
  // A subsequent density change must not reset independently owned expansion state.
  uiStateStore.trigger.setPaymentMethodExpanded({ expanded: true })
  uiStateStore.trigger.setDisplayDensity({ density: "standard" })
  expect(uiStateStore.getSnapshot().context.paymentMethodSectionExpanded).toBe(true)
})

it("restores Compact on startup and uses only the local preference loader", async () => {
  jest.mocked(loadDisplayDensity).mockResolvedValueOnce("compact")
  await initializeUIStateStore()
  expect(uiStateStore.getSnapshot().context.displayDensity).toBe("compact")
  expect(uiStateStore.getSnapshot().context.densityHydrated).toBe(true)
})
