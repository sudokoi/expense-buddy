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

import type {
  BackgroundSmsPermissionResponse,
  ExpenseBuddyBackgroundSmsNativeModule,
} from "../../modules/expense-buddy-background-sms"
import {
  approveReviewItemsAsync,
  dismissReviewItemsAsync,
  getBackgroundSmsPermissionStatus,
  getBackgroundSmsState,
  getPendingReviewQueueAsync,
  rejectReviewItemsAsync,
  requestBackgroundSmsPermission,
  setBackgroundSmsEnabled,
  setBackgroundSmsModuleForTesting,
  syncInboxAsync,
} from "./android-background-sms-module"

function createModuleOverride(
  overrides: Partial<ExpenseBuddyBackgroundSmsNativeModule> = {}
): ExpenseBuddyBackgroundSmsNativeModule {
  const defaultPermissionResponse: BackgroundSmsPermissionResponse = {
    status: "granted",
    granted: true,
    canAskAgain: true,
    expires: "never",
  }
  return {
    addListener: jest.fn() as any,
    getBackgroundSmsStateAsync: async () => ({ enabled: false }),
    setBackgroundSmsEnabledAsync: async () => undefined,
    syncInboxAsync: async () => 5,
    getPermissionStatusAsync: async () => defaultPermissionResponse,
    requestPermissionAsync: async () => defaultPermissionResponse,
    getPendingReviewQueueAsync: async () => [],
    approveReviewItemAsync: async () => undefined,
    rejectReviewItemAsync: async () => undefined,
    dismissReviewItemAsync: async () => undefined,
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

  describe("getBackgroundSmsPermissionStatus", () => {
    it("returns granted status from native module", async () => {
      setBackgroundSmsModuleForTesting(
        createModuleOverride({
          getPermissionStatusAsync: async () => ({
            status: "granted",
            granted: true,
            canAskAgain: true,
            expires: "never",
          }),
        })
      )

      await expect(getBackgroundSmsPermissionStatus()).resolves.toBe("granted")
    })

    it("returns denied status from native module", async () => {
      setBackgroundSmsModuleForTesting(
        createModuleOverride({
          getPermissionStatusAsync: async () => ({
            status: "denied",
            granted: false,
            canAskAgain: true,
            expires: "never",
          }),
        })
      )

      await expect(getBackgroundSmsPermissionStatus()).resolves.toBe("denied")
    })

    it("returns unavailable on non-Android platforms", async () => {
      const { Platform } = require("react-native")
      const originalOs = Platform.OS
      Platform.OS = "ios"
      setBackgroundSmsModuleForTesting(null)

      await expect(getBackgroundSmsPermissionStatus()).resolves.toBe("unavailable")

      Platform.OS = originalOs
    })
  })

  describe("requestBackgroundSmsPermission", () => {
    it("requests permission via native module", async () => {
      const requestPermissionAsync = jest.fn().mockResolvedValue({
        status: "granted",
        granted: true,
        canAskAgain: true,
        expires: "never",
      })
      setBackgroundSmsModuleForTesting(createModuleOverride({ requestPermissionAsync }))

      await expect(requestBackgroundSmsPermission()).resolves.toBe("granted")
      expect(requestPermissionAsync).toHaveBeenCalled()
    })
  })

  describe("syncInboxAsync", () => {
    it("returns created count from native module", async () => {
      const syncInboxAsync = jest.fn().mockResolvedValue(3)
      setBackgroundSmsModuleForTesting(createModuleOverride({ syncInboxAsync }))

      await expect(syncInboxAsync(true)).resolves.toBe(3)
      expect(syncInboxAsync).toHaveBeenCalledWith(true)
    })

    it("returns 0 on non-Android platforms", async () => {
      const { Platform } = require("react-native")
      const originalOs = Platform.OS
      Platform.OS = "ios"
      setBackgroundSmsModuleForTesting(null)

      await expect(syncInboxAsync(false)).resolves.toBe(0)

      Platform.OS = originalOs
    })

    it("surfaces native errors", async () => {
      const mockSync = jest.fn().mockRejectedValue(new Error("native sync failed"))
      setBackgroundSmsModuleForTesting(createModuleOverride({ syncInboxAsync: mockSync }))

      await expect(syncInboxAsync(false)).rejects.toThrow("native sync failed")
    })
  })
})
