/**
 * Property-based tests for Sync Manager API Backward Compatibility
 * Feature: codebase-improvements
 *
 * These tests verify that the sync-manager module exports all expected
 * public functions and types after refactoring to use the secure-storage module.
 */

import * as fc from "fast-check"

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
import * as SyncManager from "./sync-manager"

/**
 * Property 1: Sync Manager API Backward Compatibility
 * For any public function exported from sync-manager.ts before refactoring,
 * the same function with the same signature SHALL be exported after refactoring.
 */
describe("Sync Manager API Backward Compatibility", () => {
  // List of all expected exported functions
  const expectedFunctions = [
    "saveSyncConfig",
    "loadSyncConfig",
    "clearSyncConfig",
    "testConnection",
    "determineSyncDirection",
    "syncUp",
    "syncDown",
    "syncDownMore",
    "fetchAllRemoteExpenses",
    "mergeExpensesWithTimestamps",
    "smartMerge",
    "getPendingSyncCount",
    "migrateToDailyFiles",
    "gitStyleSync",
    "saveLastSyncTime",
  ] as const

  describe("Property 1: All expected functions SHALL be exported", () => {
    it("all expected functions SHALL be exported from sync-manager module", () => {
      fc.assert(
        fc.property(fc.constantFrom(...expectedFunctions), (functionName) => {
          // Verify the function exists and is a function
          const exportedValue = (SyncManager as Record<string, unknown>)[functionName]
          expect(exportedValue).toBeDefined()
          expect(typeof exportedValue).toBe("function")
          return true
        }),
        { numRuns: expectedFunctions.length }
      )
    })

    it("no unexpected functions SHALL be missing from exports", () => {
      // Verify all expected functions are present
      for (const functionName of expectedFunctions) {
        const exportedValue = (SyncManager as Record<string, unknown>)[functionName]
        expect(exportedValue).toBeDefined()
        expect(typeof exportedValue).toBe("function")
      }
    })
  })

  describe("Function signature verification", () => {
    it("saveSyncConfig SHALL accept SyncConfig and return Promise<void>", () => {
      // Type assertion - if this compiles, the signature is correct
      const fn: (config: SyncManager.SyncConfig) => Promise<void> =
        SyncManager.saveSyncConfig
      expect(typeof fn).toBe("function")
    })

    it("loadSyncConfig SHALL return Promise<SyncConfig | null>", () => {
      const fn: () => Promise<SyncManager.SyncConfig | null> = SyncManager.loadSyncConfig
      expect(typeof fn).toBe("function")
    })

    it("clearSyncConfig SHALL return Promise<void>", () => {
      const fn: () => Promise<void> = SyncManager.clearSyncConfig
      expect(typeof fn).toBe("function")
    })

    it("testConnection SHALL return Promise<SyncResult>", () => {
      const fn: () => Promise<SyncManager.SyncResult> = SyncManager.testConnection
      expect(typeof fn).toBe("function")
    })

    it("determineSyncDirection SHALL accept boolean and return Promise<SyncDirectionResult>", () => {
      const fn: (hasLocalChanges: boolean) => Promise<SyncManager.SyncDirectionResult> =
        SyncManager.determineSyncDirection
      expect(typeof fn).toBe("function")
    })

    it("mergeExpensesWithTimestamps SHALL be a synchronous function", () => {
      const fn = SyncManager.mergeExpensesWithTimestamps
      expect(typeof fn).toBe("function")
      // Verify it's not async by checking it doesn't return a promise for empty arrays
      const result = fn([], [], null)
      expect(result).toHaveProperty("merged")
      expect(result).toHaveProperty("newFromRemote")
      expect(result).toHaveProperty("updatedFromRemote")
    })
  })

  describe("Type export verification", () => {
    it("SyncConfig type SHALL be exported and usable", () => {
      // Type assertion - if this compiles, the type is exported correctly
      const config: SyncManager.SyncConfig = {
        token: "test-token",
        repo: "owner/repo",
        branch: "main",
      }
      expect(config.token).toBe("test-token")
      expect(config.repo).toBe("owner/repo")
      expect(config.branch).toBe("main")
    })

    it("SyncResult type SHALL be exported and usable", () => {
      const result: SyncManager.SyncResult = {
        success: true,
        message: "Test message",
      }
      expect(result.success).toBe(true)
      expect(result.message).toBe("Test message")
    })

    it("SyncDirection type SHALL be exported and usable", () => {
      const directions: SyncManager.SyncDirection[] = [
        "push",
        "pull",
        "conflict",
        "in_sync",
        "error",
      ]
      expect(directions).toHaveLength(5)
    })

    it("SyncDirectionResult type SHALL be exported and usable", () => {
      const result: SyncManager.SyncDirectionResult = {
        direction: "push",
        localTime: "2024-01-01T00:00:00Z",
        remoteTime: "2024-01-01T00:00:00Z",
      }
      expect(result.direction).toBe("push")
    })

    it("FetchAllRemoteResult type SHALL be exported and usable", () => {
      const result: SyncManager.FetchAllRemoteResult = {
        success: true,
        expenses: [],
        filesDownloaded: 0,
      }
      expect(result.success).toBe(true)
    })

    it("GitStyleSyncResult type SHALL be exported and usable", () => {
      const result: SyncManager.GitStyleSyncResult = {
        success: true,
        message: "Sync complete",
        filesUploaded: 1,
        filesSkipped: 0,
      }
      expect(result.success).toBe(true)
    })

    it("ConflictResolution type SHALL be exported and usable", () => {
      const resolution: SyncManager.ConflictResolution = {
        expenseId: "test-id",
        choice: "local",
      }
      expect(resolution.expenseId).toBe("test-id")
      expect(resolution.choice).toBe("local")
    })
  })
})
