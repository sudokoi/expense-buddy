/**
 * TFLite Parser Tests
 *
 * Tests for the TensorFlow Lite SMS parser
 */

// Mock expo modules
jest.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {},
    },
  },
}))

// Mock react-native-fast-tflite
jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: jest.fn(),
}))

import { TFLiteSMSParser } from "./tflite-parser"

describe("TFLiteSMSParser", () => {
  const parser = new TFLiteSMSParser()

  describe("initialization", () => {
    it("should initialize without errors", async () => {
      await expect(parser.initialize()).resolves.not.toThrow()
    })

    it("should handle missing model file gracefully", async () => {
      const parserWithMissingModel = new TFLiteSMSParser({
        modelPath: "nonexistent_model.tflite",
      })

      // Should not throw, just not set initialized
      await expect(parserWithMissingModel.initialize()).resolves.toBeUndefined()
    })

    it("should not be ready before initialization", () => {
      const newParser = new TFLiteSMSParser()
      expect(newParser.isReady()).toBe(false)
    })
  })

  describe("parse", () => {
    beforeEach(async () => {
      await parser.initialize()
    })

    it("should throw if not initialized", async () => {
      const newParser = new TFLiteSMSParser()

      await expect(newParser.parse("test")).rejects.toThrow("Model not initialized")
    })

    it("should handle missing model gracefully", async () => {
      // When model file doesn't exist, parser initializes but model is not loaded
      // parse() should handle this gracefully
      
      // Since model isn't loaded, initialized will be false
      expect(parser.isReady()).toBe(false)
      
      // Attempting to parse should throw
      await expect(parser.parse("Rs. 1000 at Amazon")).rejects.toThrow("Model not initialized")
    })
  })

  describe("configuration", () => {
    it("should accept custom configuration", () => {
      const customParser = new TFLiteSMSParser({
        modelPath: "custom_model.tflite",
        maxInputLength: 512,
        confidenceThreshold: 0.8,
        useGpuDelegate: true,
      })

      expect(customParser).toBeDefined()
    })
  })

  describe("dispose", () => {
    it("should dispose without errors", async () => {
      await parser.initialize()
      await expect(parser.dispose()).resolves.not.toThrow()
    })

    it("should set ready to false after dispose", async () => {
      const newParser = new TFLiteSMSParser()
      await newParser.initialize()
      await newParser.dispose()

      expect(newParser.isReady()).toBe(false)
    })
  })
})
