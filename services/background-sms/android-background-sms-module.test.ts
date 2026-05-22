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
  loadBackgroundSmsReviewQueueSnapshot,
  saveBackgroundSmsReviewQueueSnapshot,
  setBackgroundSmsEnabled,
  setBackgroundSmsModuleForTesting,
} from "./android-background-sms-module"
import type { SmsImportReviewQueueSnapshot } from "../../types/sms-import"

function createModuleOverride(
  overrides: Partial<ExpenseBuddyBackgroundSmsNativeModule> = {}
): ExpenseBuddyBackgroundSmsNativeModule {
  return {
    getBackgroundSmsStateAsync: async () => ({ enabled: false }),
    setBackgroundSmsEnabledAsync: async () => undefined,
    getReviewQueueSnapshotJsonAsync: async () =>
      JSON.stringify({ items: [], lastScanCursor: null, bootstrapCompletedAt: null }),
    replaceReviewQueueSnapshotJsonAsync: async () => undefined,
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

  it("parses the mirrored review queue snapshot from native storage", async () => {
    const snapshot: SmsImportReviewQueueSnapshot = {
      items: [
        {
          id: "sms_1",
          fingerprint: "sms_fingerprint",
          sourceMessage: {
            messageId: "1",
            sender: "VK-HDFCBK",
            body: "INR 100 spent at Merchant",
            receivedAt: "2026-04-11T10:10:00.000Z",
          },
          amount: 100,
          currency: "INR",
          merchantName: "Merchant",
          categorySuggestion: "Food",
          status: "pending",
          createdAt: "2026-04-11T10:10:00.000Z",
          updatedAt: "2026-04-11T10:10:00.000Z",
        },
      ],
      lastScanCursor: "2026-04-11T10:10:00.000Z",
      bootstrapCompletedAt: "2026-04-11T10:11:00.000Z",
    }

    setBackgroundSmsModuleForTesting(
      createModuleOverride({
        getReviewQueueSnapshotJsonAsync: async () => JSON.stringify(snapshot),
      })
    )

    await expect(loadBackgroundSmsReviewQueueSnapshot()).resolves.toEqual(snapshot)
  })

  it("writes queue snapshots back to the native mirror", async () => {
    const replaceReviewQueueSnapshotJsonAsync = jest.fn().mockResolvedValue(undefined)
    const snapshot: SmsImportReviewQueueSnapshot = {
      items: [],
      lastScanCursor: null,
      bootstrapCompletedAt: null,
    }

    setBackgroundSmsModuleForTesting(
      createModuleOverride({ replaceReviewQueueSnapshotJsonAsync })
    )

    await saveBackgroundSmsReviewQueueSnapshot(snapshot)

    expect(replaceReviewQueueSnapshotJsonAsync).toHaveBeenCalledWith(
      JSON.stringify(snapshot)
    )
  })

  it("enables background SMS processing via native state", async () => {
    const setBackgroundSmsEnabledAsync = jest.fn().mockResolvedValue(undefined)
    setBackgroundSmsModuleForTesting(
      createModuleOverride({ setBackgroundSmsEnabledAsync })
    )

    await setBackgroundSmsEnabled(true)

    expect(setBackgroundSmsEnabledAsync).toHaveBeenCalledWith(true)
  })

  it("swallows native failures when updating background SMS state", async () => {
    const setBackgroundSmsEnabledAsync = jest
      .fn()
      .mockRejectedValue(new Error("native unavailable"))
    setBackgroundSmsModuleForTesting(
      createModuleOverride({ setBackgroundSmsEnabledAsync })
    )

    await expect(setBackgroundSmsEnabled(true)).resolves.toBeUndefined()
  })
})
