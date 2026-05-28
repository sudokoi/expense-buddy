jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("../../services/logger", () => ({
  logAsync: jest.fn(),
}))

jest.mock("../../modules/expense-buddy-background-sms", () => ({
  __esModule: true,
  default: null,
}))

import type { ExpenseBuddyBackgroundSmsNativeModule } from "../../modules/expense-buddy-background-sms"
import {
  approveReviewItemsAsync,
  dismissReviewItemsAsync,
  getBackgroundSmsState,
  getPendingReviewQueueAsync,
  rejectReviewItemsAsync,
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
    approveItemsAsync: async () => undefined,
    rejectItemsAsync: async () => undefined,
    dismissItemsAsync: async () => undefined,
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

  it("approveReviewItemsAsync calls native batch API with fingerprints", async () => {
    const approveItemsAsync = jest.fn().mockResolvedValue(undefined)
    setBackgroundSmsModuleForTesting(createModuleOverride({ approveItemsAsync }))

    await approveReviewItemsAsync(["fp1", "fp2"])

    expect(approveItemsAsync).toHaveBeenCalledWith(["fp1", "fp2"])
  })

  it("rejectReviewItemsAsync calls native batch API with fingerprints", async () => {
    const rejectItemsAsync = jest.fn().mockResolvedValue(undefined)
    setBackgroundSmsModuleForTesting(createModuleOverride({ rejectItemsAsync }))

    await rejectReviewItemsAsync(["fp3", "fp4"])

    expect(rejectItemsAsync).toHaveBeenCalledWith(["fp3", "fp4"])
  })

  it("dismissReviewItemsAsync calls native batch API with fingerprints", async () => {
    const dismissItemsAsync = jest.fn().mockResolvedValue(undefined)
    setBackgroundSmsModuleForTesting(createModuleOverride({ dismissItemsAsync }))

    await dismissReviewItemsAsync(["fp5", "fp6"])

    expect(dismissItemsAsync).toHaveBeenCalledWith(["fp5", "fp6"])
  })
})
