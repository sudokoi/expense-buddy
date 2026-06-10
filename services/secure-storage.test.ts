import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Mock react-native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}))

import { setItem, getItem, deleteItem, secureStorage } from "./secure-storage"

describe("Secure Storage Module", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    ;(SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined)
    ;(SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined)
  })

  describe("on Android", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "android"
    })

    describe("setItem", () => {
      it("should store value using SecureStore on Android", async () => {
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
      it("should retrieve value using SecureStore on Android", async () => {
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
      it("should delete value using SecureStore on Android", async () => {
        await deleteItem("test-key")

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("test-key")
      })
    })
  })

  describe("on non-Android platforms", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "ios"
    })

    afterAll(() => {
      ;(Platform as { OS: string }).OS = "android"
    })

    describe("setItem", () => {
      it("should be a no-op on non-Android", async () => {
        await setItem("test-key", "test-value")

        expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
      })
    })

    describe("getItem", () => {
      it("should return null on non-Android", async () => {
        ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("stored-value")

        const result = await getItem("test-key")

        expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
        expect(result).toBeNull()
      })
    })

    describe("deleteItem", () => {
      it("should be a no-op on non-Android", async () => {
        await deleteItem("test-key")

        expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled()
      })
    })
  })

  describe("secureStorage object interface", () => {
    beforeAll(() => {
      ;(Platform as { OS: string }).OS = "android"
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
