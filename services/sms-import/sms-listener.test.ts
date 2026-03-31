/**
 * Unit tests for SMS Listener (Native SMS Module Integration)
 *
 * These tests verify the sms-listener.ts implementation with:
 * - startListening calls startReadSMS when permissions are granted
 * - Incoming SMS triggers handleIncomingMessage
 * - dispose calls the unsubscribe function
 * - Graceful failure when startReadSMS throws
 */

// --- Mocks must be declared before imports ---

jest.mock("@maniac-tech/react-native-expo-read-sms", () => ({
  startReadSMS: jest.fn().mockReturnValue(jest.fn()),
  requestReadSMSPermission: jest.fn().mockResolvedValue(true),
}))

jest.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}))

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}))

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}))

jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: jest.fn().mockResolvedValue({
    run: jest.fn().mockResolvedValue([new ArrayBuffer(128 * 7 * 4)]),
  }),
}))

// Mock settings to return enabled by default
const mockLoadSettings = jest.fn().mockResolvedValue({
  enabled: true,
  syncLearnings: false,
})
jest.mock("./settings", () => ({
  loadSMSImportSettings: (...args: unknown[]) => mockLoadSettings(...args),
}))

// Mock permissions to return granted by default
const mockCheckSMSPermission = jest.fn().mockResolvedValue(true)
jest.mock("./permissions", () => ({
  checkSMSPermission: (...args: unknown[]) => mockCheckSMSPermission(...args),
}))

// Mock ML parser
const mockParse = jest.fn().mockResolvedValue({
  parsed: null,
  method: "none",
  confidence: 0,
})
const mockInitialize = jest.fn().mockResolvedValue(undefined)
const mockDispose = jest.fn().mockResolvedValue(undefined)
jest.mock("./ml/ml-parser", () => ({
  mlParser: {
    parse: (...args: unknown[]) => mockParse(...args),
    initialize: (...args: unknown[]) => mockInitialize(...args),
    dispose: (...args: unknown[]) => mockDispose(...args),
  },
}))

// Mock duplicate detector
jest.mock("./duplicate-detector", () => ({
  duplicateDetector: {
    check: jest.fn().mockResolvedValue({ isDuplicate: false }),
    markProcessed: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock learning engine
jest.mock("./learning-engine", () => ({
  merchantLearningEngine: {
    suggest: jest.fn().mockResolvedValue(null),
  },
}))

import {
  startReadSMS,
  requestReadSMSPermission,
} from "@maniac-tech/react-native-expo-read-sms"
import { SMSListener } from "./sms-listener"

const mockedStartReadSMS = startReadSMS as jest.Mock
const mockedRequestPermission = requestReadSMSPermission as jest.Mock

describe("SMS Listener", () => {
  let listener: SMSListener

  beforeEach(() => {
    jest.clearAllMocks()
    listener = new SMSListener()
    mockedRequestPermission.mockResolvedValue(true)
    mockedStartReadSMS.mockReturnValue(jest.fn())
    mockLoadSettings.mockResolvedValue({
      enabled: true,
      syncLearnings: false,
    })
    mockCheckSMSPermission.mockResolvedValue(true)
  })

  afterEach(async () => {
    await listener.dispose()
  })

  describe("startListening via initialize", () => {
    it("should call startReadSMS when permissions are granted", async () => {
      await listener.initialize()

      expect(mockedRequestPermission).toHaveBeenCalled()
      expect(mockedStartReadSMS).toHaveBeenCalled()
      expect(listener.isActive()).toBe(true)
    })

    it("should not call startReadSMS when permission is denied", async () => {
      mockedRequestPermission.mockResolvedValue(false)

      await listener.initialize()

      expect(mockedRequestPermission).toHaveBeenCalled()
      expect(mockedStartReadSMS).not.toHaveBeenCalled()
      expect(listener.isActive()).toBe(false)
    })
  })

  describe("incoming SMS handling", () => {
    it("should trigger handleIncomingMessage when SMS is received", async () => {
      const handleSpy = jest.spyOn(listener, "handleIncomingMessage")

      mockedStartReadSMS.mockImplementation(
        (successCb: (status: string, sms: string, error: string) => void) => {
          successCb("success", "[+919999999999, Rs.500 debited from a/c]", "")
          return jest.fn()
        }
      )

      await listener.initialize()

      expect(handleSpy).toHaveBeenCalledWith("Rs.500 debited from a/c", "+919999999999")
    })

    it("should handle SMS string without bracket format as raw message", async () => {
      const handleSpy = jest.spyOn(listener, "handleIncomingMessage")

      mockedStartReadSMS.mockImplementation(
        (successCb: (status: string, sms: string, error: string) => void) => {
          successCb("success", "plain text message", "")
          return jest.fn()
        }
      )

      await listener.initialize()

      expect(handleSpy).toHaveBeenCalledWith("plain text message")
    })
  })

  describe("dispose", () => {
    it("should call the unsubscribe function returned by startReadSMS", async () => {
      const mockUnsubscribe = jest.fn()
      mockedStartReadSMS.mockReturnValue(mockUnsubscribe)

      await listener.initialize()
      await listener.dispose()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(listener.isActive()).toBe(false)
    })
  })

  describe("error handling", () => {
    it("should not crash when startReadSMS throws", async () => {
      mockedStartReadSMS.mockImplementation(() => {
        throw new Error("Native module unavailable")
      })

      await listener.initialize()

      expect(listener.isActive()).toBe(false)
    })

    it("should not crash when requestReadSMSPermission throws", async () => {
      mockedRequestPermission.mockRejectedValue(new Error("Permission request failed"))

      await listener.initialize()

      expect(listener.isActive()).toBe(false)
    })
  })
})
