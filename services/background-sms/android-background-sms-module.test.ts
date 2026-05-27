jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("../../modules/expense-buddy-background-sms", () => ({
  __esModule: true,
  default: null,
}))

import type { ExpenseBuddyBackgroundSmsNativeModule } from "../../modules/expense-buddy-background-sms"
import {
  getBackgroundSmsState,
  getPendingReviewQueueAsync,
  setBackgroundSmsEnabled,
  setBackgroundSmsModuleForTesting,
} from "./android-background-sms-module"

function createModuleOverride(
  overrides: Partial<ExpenseBuddyBackgroundSmsNativeModule> = {}
): ExpenseBuddyBackgroundSmsNativeModule {
  return {
    getBackgroundSmsStateAsync: async () => ({ enabled: false }),
    setBackgroundSmsEnabledAsync: async () => undefined,
    getPendingReviewQueueAsync: async () => [],
    approveReviewItemAsync: async () => undefined,
    rejectReviewItemAsync: async () => undefined,
    dismissReviewItemAsync: async () => undefined,
    insertPendingItemsAsync: async () => undefined,
    ...overrides,
  } as ExpenseBuddyBackgroundSmsNativeModule
}

describe("android-background-sms-module", () => {
  beforeEach(() => {
    setBackgroundSmsModuleForTesting(null)
    jest.restoreAllMocks()
  })

  afterAll(() => {
    setBackgroundSmsModuleForTesting(null)
  })

  it("loads background enabled state from the native module", async () => {
    setBackgroundSmsModuleForTesting(
      createModuleOverride({
        getBackgroundSmsStateAsync: async () => ({ enabled: true }),
      })
    )

    await expect(getBackgroundSmsState()).resolves.toEqual({ enabled: true })
  })

  it("returns empty array when no pending items exist", async () => {
    setBackgroundSmsModuleForTesting(
      createModuleOverride({
        getPendingReviewQueueAsync: async () => [],
      })
    )

    await expect(getPendingReviewQueueAsync()).resolves.toEqual([])
  })

  it("enables background SMS processing via native state", async () => {
    const setBackgroundSmsEnabledAsync = jest.fn().mockResolvedValue(undefined)
    setBackgroundSmsModuleForTesting(
      createModuleOverride({ setBackgroundSmsEnabledAsync })
    )

    await setBackgroundSmsEnabled(true)

    expect(setBackgroundSmsEnabledAsync).toHaveBeenCalledWith(true)
  })

  it("surfaces native failures when updating background SMS state", async () => {
    const setBackgroundSmsEnabledAsync = jest
      .fn()
      .mockRejectedValue(new Error("native unavailable"))
    setBackgroundSmsModuleForTesting(
      createModuleOverride({ setBackgroundSmsEnabledAsync })
    )

    await expect(setBackgroundSmsEnabled(true)).rejects.toThrow("native unavailable")
  })
})
