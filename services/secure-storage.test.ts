/**
 * Unit tests for Secure Storage Module
 *
 * Tests the platform-aware secure storage operations (setItem, getItem, deleteItem).
 */

import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}))

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

describe("Secure Storage Module", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("on native platforms (iOS/Android)", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "ios"
    })

    describe("setItem", () => {
      it("should store value using SecureStore on native", async () => {
        await setItem("test-key", "test-value")

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith("test-key", "test-value")
        expect(AsyncStorage.setItem).not.toHaveBeenCalled()
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
        expect(AsyncStorage.getItem).not.toHaveBeenCalled()
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
        expect(AsyncStorage.removeItem).not.toHaveBeenCalled()
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
      it("should store value using AsyncStorage on web", async () => {
        await setItem("test-key", "test-value")

        expect(AsyncStorage.setItem).toHaveBeenCalledWith("test-key", "test-value")
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
      })
    })

    describe("getItem", () => {
      it("should retrieve value using AsyncStorage on web", async () => {
        ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("web-stored-value")

        const result = await getItem("test-key")

        expect(AsyncStorage.getItem).toHaveBeenCalledWith("test-key")
        expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
        expect(result).toBe("web-stored-value")
      })

      it("should return null for non-existent keys on web", async () => {
        ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)

        const result = await getItem("non-existent-key")

        expect(result).toBeNull()
      })
    })

    describe("deleteItem", () => {
      it("should delete value using AsyncStorage on web", async () => {
        await deleteItem("test-key")

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith("test-key")
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
