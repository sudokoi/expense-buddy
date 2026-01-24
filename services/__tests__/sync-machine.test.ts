/**
 * Integration tests for the Sync State Machine (Git-Style Unified Flow)
 *
 * These tests verify the sync-machine.ts implementation with the unified
 * fetch-merge-push flow, including:
 * - State transitions through the unified sync flow
 * - Callback invocation with correct data
 * - Conflict detection and resolution
 * - Error handling
 */

import { createActor } from "xstate"
import type { SyncCallbacks } from "../sync-machine"
import type { Expense } from "../../types/expense"
import type { TrueConflict, MergeResult } from "../merge-engine"
import type { GitStyleSyncResult, ConflictResolution } from "../sync-manager"

// expo-secure-store is ESM in node_modules; mock it before importing sync-machine.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Mock i18next
jest.mock("i18next", () => ({
  t: (key: string) => key,
}))

// settings-manager uses Platform checks; keep it deterministic for tests.
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}))

// Import sync-machine after mocks are registered.
const { syncMachine } = require("../sync-machine") as typeof import("../sync-machine")

// Mock the sync-manager module
jest.mock("../sync-manager", () => ({
  gitStyleSync: jest.fn(),
  loadSyncConfig: jest.fn(),
}))

// Import mocked functions
import { gitStyleSync, loadSyncConfig } from "../sync-manager"

const mockGitStyleSync = gitStyleSync as jest.MockedFunction<typeof gitStyleSync>
const mockLoadSyncConfig = loadSyncConfig as jest.MockedFunction<typeof loadSyncConfig>

// Test data factories
function createTestExpense(overrides: Partial<Expense> = {}): Expense {
  const now = new Date().toISOString()
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    amount: 100,
    note: "Test expense",
    category: "Food",
    date: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createMergeResult(overrides: Partial<MergeResult> = {}): MergeResult {
  return {
    merged: [],
    addedFromRemote: [],
    updatedFromRemote: [],
    addedFromLocal: [],
    updatedFromLocal: [],
    autoResolved: [],
    trueConflicts: [],
    ...overrides,
  }
}

describe("Sync Machine Integration Tests (Git-Style Flow)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: sync is configured
    mockLoadSyncConfig.mockResolvedValue({
      token: "test-token",
      repo: "test/repo",
      branch: "main",
    })
  })

  describe("Unified Sync Flow State Transitions", () => {
    it("should transition idle → syncing → success on successful sync", async () => {
      const mergeResult = createMergeResult({
        merged: [createTestExpense()],
        addedFromLocal: [createTestExpense()],
      })

      const syncResult: GitStyleSyncResult = {
        success: true,
        message: "Synced 1 expense",
        mergeResult,
        filesUploaded: 1,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      const actor = createActor(syncMachine)
      actor.start()

      // Track state transitions
      const states: string[] = []
      actor.subscribe((snapshot) => {
        states.push(snapshot.value as string)
      })

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
      })

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(states).toContain("syncing")
      expect(states).toContain("success")

      actor.stop()
    })

    it("should transition to inSync when no changes needed", async () => {
      const mergeResult = createMergeResult({
        merged: [createTestExpense()],
      })

      const syncResult: GitStyleSyncResult = {
        success: true,
        message: "Already in sync",
        mergeResult,
        filesUploaded: 0,
        filesSkipped: 1,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      const onInSync = jest.fn()
      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onInSync },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(onInSync).toHaveBeenCalled()

      actor.stop()
    })

    it("should transition to error state on sync failure", async () => {
      const syncResult: GitStyleSyncResult = {
        success: false,
        message: "Sync failed",
        error: "Network error",
        filesUploaded: 0,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      const onError = jest.fn()
      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onError).toHaveBeenCalledWith("Network error")

      actor.stop()
    })

    it("should transition to error when no sync config", async () => {
      mockLoadSyncConfig.mockResolvedValue(null)

      const onError = jest.fn()
      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onError).toHaveBeenCalledWith("githubSync.manager.noConfigFound")

      actor.stop()
    })
  })

  describe("Conflict Detection and Resolution", () => {
    it("should transition to conflict state when true conflicts detected", async () => {
      const localExpense = createTestExpense({ id: "conflict-1", note: "Local version" })
      const remoteExpense = createTestExpense({
        id: "conflict-1",
        note: "Remote version",
      })

      const trueConflict: TrueConflict = {
        expenseId: "conflict-1",
        localVersion: localExpense,
        remoteVersion: remoteExpense,
        reason: "equal_timestamps",
      }

      const mergeResult = createMergeResult({
        trueConflicts: [trueConflict],
      })

      const syncResult: GitStyleSyncResult = {
        success: false,
        message: "Conflicts detected",
        mergeResult,
        error: "Conflicts detected but no conflict handler provided",
        filesUploaded: 0,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      const onConflict = jest.fn()
      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [localExpense],
        syncSettingsEnabled: false,
        callbacks: { onConflict },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("conflict")
      expect(onConflict).toHaveBeenCalledWith([trueConflict])
      expect(actor.getSnapshot().context.pendingConflicts).toHaveLength(1)

      actor.stop()
    })

    it("should transition conflict → pushing → success after RESOLVE_CONFLICTS", async () => {
      const localExpense = createTestExpense({ id: "conflict-1", note: "Local version" })
      const remoteExpense = createTestExpense({
        id: "conflict-1",
        note: "Remote version",
      })

      const trueConflict: TrueConflict = {
        expenseId: "conflict-1",
        localVersion: localExpense,
        remoteVersion: remoteExpense,
        reason: "equal_timestamps",
      }

      // First call returns conflicts
      const conflictResult: GitStyleSyncResult = {
        success: false,
        message: "Conflicts detected",
        mergeResult: createMergeResult({ trueConflicts: [trueConflict] }),
        error: "Conflicts detected",
        filesUploaded: 0,
        filesSkipped: 0,
      }

      // Second call (after resolution) succeeds
      const successResult: GitStyleSyncResult = {
        success: true,
        message: "Synced after conflict resolution",
        mergeResult: createMergeResult({ merged: [localExpense] }),
        filesUploaded: 1,
        filesSkipped: 0,
      }

      mockGitStyleSync
        .mockResolvedValueOnce(conflictResult)
        .mockResolvedValueOnce(successResult)

      const actor = createActor(syncMachine)
      actor.start()

      const states: string[] = []
      actor.subscribe((snapshot) => {
        states.push(snapshot.value as string)
      })

      // Start sync
      actor.send({
        type: "SYNC",
        localExpenses: [localExpense],
        syncSettingsEnabled: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("conflict")

      // Resolve conflicts
      const resolutions: ConflictResolution[] = [
        { expenseId: "conflict-1", choice: "local" },
      ]
      actor.send({ type: "RESOLVE_CONFLICTS", resolutions })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(states).toContain("pushing")
      expect(states).toContain("success")

      actor.stop()
    })

    it("should return to idle on CANCEL from conflict state", async () => {
      const trueConflict: TrueConflict = {
        expenseId: "conflict-1",
        localVersion: createTestExpense(),
        remoteVersion: createTestExpense(),
        reason: "equal_timestamps",
      }

      const syncResult: GitStyleSyncResult = {
        success: false,
        message: "Conflicts detected",
        mergeResult: createMergeResult({ trueConflicts: [trueConflict] }),
        error: "Conflicts detected",
        filesUploaded: 0,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("conflict")

      actor.send({ type: "CANCEL" })
      expect(actor.getSnapshot().value).toBe("idle")
      expect(actor.getSnapshot().context.pendingConflicts).toBeUndefined()

      actor.stop()
    })
  })

  describe("Callback Invocation with Correct Data", () => {
    it("onSuccess callback should receive syncResult and mergeResult", async () => {
      const mergedExpenses = [
        createTestExpense({ note: "Expense 1" }),
        createTestExpense({ note: "Expense 2" }),
      ]

      const mergeResult = createMergeResult({
        merged: mergedExpenses,
        addedFromRemote: [mergedExpenses[0]],
        updatedFromLocal: [mergedExpenses[1]],
      })

      const syncResult: GitStyleSyncResult = {
        success: true,
        message: "Synced 2 expenses",
        mergeResult,
        filesUploaded: 2,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      let receivedResult:
        | { syncResult?: GitStyleSyncResult; mergeResult?: MergeResult }
        | undefined

      const onSuccess: SyncCallbacks["onSuccess"] = (result) => {
        receivedResult = result
      }

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onSuccess },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedResult).toBeDefined()
      expect(receivedResult?.syncResult).toBeDefined()
      expect(receivedResult?.syncResult?.success).toBe(true)
      expect(receivedResult?.syncResult?.filesUploaded).toBe(2)
      expect(receivedResult?.mergeResult).toBeDefined()
      expect(receivedResult?.mergeResult?.merged).toHaveLength(2)
      expect(receivedResult?.mergeResult?.addedFromRemote).toHaveLength(1)

      actor.stop()
    })

    it("onConflict callback should receive TrueConflict array", async () => {
      const conflict1: TrueConflict = {
        expenseId: "c1",
        localVersion: createTestExpense({ id: "c1", note: "Local 1" }),
        remoteVersion: createTestExpense({ id: "c1", note: "Remote 1" }),
        reason: "equal_timestamps",
      }
      const conflict2: TrueConflict = {
        expenseId: "c2",
        localVersion: createTestExpense({ id: "c2", note: "Local 2" }),
        remoteVersion: createTestExpense({ id: "c2", note: "Remote 2" }),
        reason: "within_threshold",
      }

      const syncResult: GitStyleSyncResult = {
        success: false,
        message: "Conflicts detected",
        mergeResult: createMergeResult({ trueConflicts: [conflict1, conflict2] }),
        error: "Conflicts detected",
        filesUploaded: 0,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      let receivedConflicts: TrueConflict[] | undefined

      const onConflict: SyncCallbacks["onConflict"] = (conflicts) => {
        receivedConflicts = conflicts
      }

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        callbacks: { onConflict },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedConflicts).toBeDefined()
      expect(receivedConflicts).toHaveLength(2)
      expect(receivedConflicts?.[0].expenseId).toBe("c1")
      expect(receivedConflicts?.[0].localVersion.note).toBe("Local 1")
      expect(receivedConflicts?.[0].remoteVersion.note).toBe("Remote 1")
      expect(receivedConflicts?.[1].reason).toBe("within_threshold")

      actor.stop()
    })

    it("onError callback should receive error message", async () => {
      const syncResult: GitStyleSyncResult = {
        success: false,
        message: "Sync failed",
        error: "Failed to fetch remote expenses",
        filesUploaded: 0,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      let receivedError: string | undefined

      const onError: SyncCallbacks["onError"] = (error) => {
        receivedError = error
      }

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedError).toBe("Failed to fetch remote expenses")

      actor.stop()
    })
  })

  describe("Error Handling", () => {
    it("should handle network errors during sync", async () => {
      mockGitStyleSync.mockRejectedValue(new Error("Network error"))

      const onError = jest.fn()
      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onError).toHaveBeenCalledWith(expect.stringContaining("Network error"))

      actor.stop()
    })

    it("should allow retry from error state", async () => {
      // First call fails
      mockGitStyleSync.mockRejectedValueOnce(new Error("Network error"))

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("error")

      // Second call succeeds
      const successResult: GitStyleSyncResult = {
        success: true,
        message: "Synced",
        mergeResult: createMergeResult(),
        filesUploaded: 0,
        filesSkipped: 1,
      }
      mockGitStyleSync.mockResolvedValue(successResult)

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 150))
      // Should have transitioned through inSync back to idle
      expect(actor.getSnapshot().value).toBe("idle")

      actor.stop()
    })

    it("should handle errors during conflict resolution push", async () => {
      const trueConflict: TrueConflict = {
        expenseId: "conflict-1",
        localVersion: createTestExpense(),
        remoteVersion: createTestExpense(),
        reason: "equal_timestamps",
      }

      // First call returns conflicts
      const conflictResult: GitStyleSyncResult = {
        success: false,
        message: "Conflicts detected",
        mergeResult: createMergeResult({ trueConflicts: [trueConflict] }),
        error: "Conflicts detected",
        filesUploaded: 0,
        filesSkipped: 0,
      }

      mockGitStyleSync
        .mockResolvedValueOnce(conflictResult)
        .mockRejectedValueOnce(new Error("Push failed after resolution"))

      const onError = jest.fn()
      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("conflict")

      // Resolve conflicts
      actor.send({
        type: "RESOLVE_CONFLICTS",
        resolutions: [{ expenseId: "conflict-1", choice: "local" }],
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("Push failed after resolution")
      )

      actor.stop()
    })
  })

  describe("RESET Event", () => {
    it("should reset from success state to idle", async () => {
      const syncResult: GitStyleSyncResult = {
        success: true,
        message: "Synced",
        mergeResult: createMergeResult(),
        filesUploaded: 1,
        filesSkipped: 0,
      }
      mockGitStyleSync.mockResolvedValue(syncResult)

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("success")

      actor.send({ type: "RESET" })
      expect(actor.getSnapshot().value).toBe("idle")

      actor.stop()
    })

    it("should reset from error state to idle", async () => {
      mockGitStyleSync.mockRejectedValue(new Error("Failed"))

      const actor = createActor(syncMachine)
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("error")

      actor.send({ type: "RESET" })
      expect(actor.getSnapshot().value).toBe("idle")

      actor.stop()
    })
  })
})
