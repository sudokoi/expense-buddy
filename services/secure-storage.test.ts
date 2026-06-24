/**
 * Unit tests for Secure Storage Module
 *
 * Tests the platform-aware secure storage operations (setItem, getItem, deleteItem).
 */

import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { getItem as getStorageItem, setItem as setStorageItem } from "./storage"

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}))

// Import after mocks are set up
import { setItem, getItem, deleteItem, secureStorage } from "./secure-storage"
import { clear } from "./storage"

describe("Secure Storage Module", () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await clear()
  })

  describe("on native platforms (iOS/Android)", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "ios"
    })

    describe("setItem", () => {
      it("should store value using SecureStore on native", async () => {
        await setItem("test-key", "test-value")

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith("test-key", "test-value")
      })

      it("should handle empty string values", async () => {
        await setItem("empty-key", "")

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith("empty-key", "")
      })

      it("should handle special characters in values", async () => {
        const specialValue = '{"token": "abc123!@#$%^&*()"}'
        await setItem("special-key", specialValue)

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith("special-key", specialValue)
      })
    })

    describe("getItem", () => {
      it("should retrieve value using SecureStore on native", async () => {
        ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("stored-value")

        const result = await getItem("test-key")

        expect(SecureStore.getItemAsync).toHaveBeenCalledWith("test-key")
        expect(result).toBe("stored-value")
      })

      it("should return null for non-existent keys", async () => {
        ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null)

        const result = await getItem("non-existent-key")

        expect(result).toBeNull()
      })
    })

    describe("deleteItem", () => {
      it("should delete value using SecureStore on native", async () => {
        await deleteItem("test-key")

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("test-key")
      })
    })
  })

  describe("on web platform", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "web"
    })

    afterAll(() => {
      ;(Platform as { OS: string }).OS = "ios"
    })

    describe("setItem", () => {
      it("should store value using storage module on web", async () => {
        await setItem("test-key", "test-value")

        const stored = await getStorageItem("test-key")
        expect(stored).toBe("test-value")
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
      })
    })

    describe("getItem", () => {
      it("should retrieve value using storage module on web", async () => {
        await setStorageItem("test-key", "web-stored-value")

        const result = await getItem("test-key")

        expect(result).toBe("web-stored-value")
        expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
      })

      it("should return null for non-existent keys on web", async () => {
        const result = await getItem("non-existent-key")

        expect(result).toBeNull()
      })
    })

    describe("deleteItem", () => {
      it("should delete value using storage module on web", async () => {
        await setStorageItem("test-key", "test-value")
        await deleteItem("test-key")

        const stored = await getStorageItem("test-key")
        expect(stored).toBeNull()
        expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled()
      })
    })
  })

  describe("secureStorage object interface", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "ios"
    })

    it("should expose setItem method", async () => {
      await secureStorage.setItem("obj-key", "obj-value")

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("obj-key", "obj-value")
    })

    it("should expose getItem method", async () => {
      ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("obj-stored")

      const result = await secureStorage.getItem("obj-key")

      expect(result).toBe("obj-stored")
    })

    it("should expose deleteItem method", async () => {
      await secureStorage.deleteItem("obj-key")

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("obj-key")
    })
  })
})
