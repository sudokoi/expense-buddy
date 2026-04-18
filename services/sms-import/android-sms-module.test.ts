jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}))

jest.mock("../../modules/expense-buddy-sms-import", () => ({
  __esModule: true,
  default: null,
}))

import type {
  NativeSmsCategoryPredictionRequest,
  SmsImportPermissionResponse,
  SmsImportScanOptions,
} from "../../modules/expense-buddy-sms-import"
import {
  categorizeSmsImportMessages,
  setAndroidSmsModuleForTesting,
  type AndroidSmsModule,
} from "./android-sms-module"

function createModuleOverride(
  overrides: Partial<AndroidSmsModule> = {}
): AndroidSmsModule {
  return {
    getPermissionStatusAsync: async (): Promise<SmsImportPermissionResponse> => ({
      status: "granted",
      granted: true,
      canAskAgain: true,
      expires: "never",
    }),
    requestPermissionAsync: async (): Promise<SmsImportPermissionResponse> => ({
      status: "granted",
      granted: true,
      canAskAgain: true,
      expires: "never",
    }),
    scanMessagesAsync: async (_options: SmsImportScanOptions) => [],
    ...overrides,
  }
}

describe("categorizeSmsImportMessages", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__

  beforeEach(() => {
    setAndroidSmsModuleForTesting(null)
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
    jest.restoreAllMocks()
  })

  afterAll(() => {
    setAndroidSmsModuleForTesting(null)
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = originalDev
  })

  it("logs in dev and falls back to regex when native categorization fails", async () => {
    const requests: NativeSmsCategoryPredictionRequest[] = [
      {
        messageId: "sms-1",
        sender: "VK-HDFCBK",
        body: "INR 499 spent at Amazon Marketplace using debit card",
        merchantName: "Amazon Marketplace",
      },
    ]
    const warningSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

    ;(globalThis as { __DEV__?: boolean }).__DEV__ = true
    setAndroidSmsModuleForTesting(
      createModuleOverride({
        categorizeMessagesAsync: jest.fn().mockRejectedValue(new Error("native boom")),
      })
    )

    await expect(categorizeSmsImportMessages(requests)).resolves.toEqual([])
    expect(warningSpy).toHaveBeenCalledWith(
      "[android-sms-module] categorizeMessagesAsync failed:",
      expect.any(Error)
    )
  })
})
