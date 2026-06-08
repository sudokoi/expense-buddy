/**
 * Integration tests for the Sync State Machine (Provider-Based Flow)
 *
 * These tests verify the sync-machine.ts implementation with the
 * provider-based sync flow, including:
 * - State transitions through the unified sync flow
 * - Callback invocation with correct data
 * - Conflict detection and resolution
 * - Initial reconciliation flow
 * - Error handling
 */

import { createActor } from "xstate"
import type { SyncCallbacks } from "../sync-machine"
import type { Expense } from "../../types/expense"
import type { TrueConflict, MergeResult } from "../merge-engine"
import type { SyncProvider } from "../sync/provider-types"

// Mock expo-secure-store before any imports that depend on it.
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

// Mock the sync-with-provider module
const mockSyncWithProvider = jest.fn<any, any[]>()
const mockFirstTimeSync = jest.fn<any, any[]>()

jest.mock("../sync/sync-with-provider", () => ({
  syncWithProvider: (...args: any[]) => mockSyncWithProvider(...args),
  firstTimeSync: (...args: any[]) => mockFirstTimeSync(...args),
}))

// Import mocked functions
import { syncMachine } from "../sync-machine"

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

const mockProvider: SyncProvider = {
  kind: "github",
  providerId: "test",
  testConnection: jest.fn(),
  readSnapshot: jest.fn(),
  writeSnapshot: jest.fn(),
  getStatus: jest.fn(),
}

describe("Sync Machine Integration Tests (Provider-Based Flow)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Unified Sync Flow State Transitions", () => {
    it("should transition idle → syncing → success on successful sync", async () => {
      const mergeResult = createMergeResult({
        merged: [createTestExpense()],
        addedFromLocal: [createTestExpense()],
      })

      mockSyncWithProvider.mockResolvedValue({
        success: true,
        mergeResult,
      })

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      const states: string[] = []
      actor.subscribe((snapshot) => {
        states.push(snapshot.value as string)
      })

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(states).toContain("syncing")
      expect(states).toContain("success")

      actor.stop()
    })

    it("should transition to inSync when no changes needed", async () => {
      const mergeResult = createMergeResult({
        merged: [createTestExpense()],
      })

      mockSyncWithProvider.mockResolvedValue({
        success: true,
        mergeResult,
        isInSync: true,
      })

      const onSuccess = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onSuccess },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(onSuccess).toHaveBeenCalledWith({ mergeResult })

      actor.stop()
    })

    it("should transition to error state on sync failure", async () => {
      mockSyncWithProvider.mockResolvedValue({
        success: false,
        error: "Network error",
      })

      const onError = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onError).toHaveBeenCalledWith("Network error")

      actor.stop()
    })

    it("should transition through initial reconciliation on first sync", async () => {
      mockSyncWithProvider.mockResolvedValue({
        success: true,
        isFirstSync: true,
      })

      mockFirstTimeSync.mockResolvedValue({
        success: true,
        isFirstSync: true,
      })

      const onSuccess = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      const states: string[] = []
      actor.subscribe((snapshot) => {
        states.push(snapshot.value as string)
      })

      // Background SYNC for an unreconciled provider enters the real gate.
      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onSuccess },
      })

      expect(states).toContain("awaitingInitialReconciliation")

      // Activation-driven trigger advances the gate into reconciliation.
      actor.send({ type: "START_FIRST_SYNC" })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(states).toContain("reconcilingFirstSync")
      expect(states).toContain("success")
      expect(onSuccess).toHaveBeenCalledWith({ isFirstSync: true })

      actor.stop()
    })

    it("should ignore background SYNC events while awaiting initial reconciliation", async () => {
      const onSuccess = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onSuccess },
      })

      expect(actor.getSnapshot().value).toBe("awaitingInitialReconciliation")

      // A second background SYNC must not pass the gate.
      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onSuccess },
      })

      expect(actor.getSnapshot().value).toBe("awaitingInitialReconciliation")
      expect(mockFirstTimeSync).not.toHaveBeenCalled()

      actor.stop()
    })

    it("should run a normal sync when the provider is already reconciled", async () => {
      mockSyncWithProvider.mockResolvedValue({
        success: true,
      })

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      const states: string[] = []
      actor.subscribe((snapshot) => {
        states.push(snapshot.value as string)
      })

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: {},
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(states).toContain("syncing")
      expect(states).not.toContain("awaitingInitialReconciliation")

      actor.stop()
    })

    it("should set initialReconciliationComplete and reach success after first reconciliation", async () => {
      mockFirstTimeSync.mockResolvedValue({
        success: true,
        isFirstSync: true,
      })

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: {},
      })

      actor.send({ type: "START_FIRST_SYNC" })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("success")
      expect(actor.getSnapshot().context.initialReconciliationComplete).toBe(true)

      actor.stop()
    })

    it("should return to the gate when firstTimeSync fails", async () => {
      mockFirstTimeSync.mockResolvedValue({
        success: false,
        error: "Failed to create initial snapshot",
      })

      const onError = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      const states: string[] = []
      actor.subscribe((snapshot) => {
        states.push(snapshot.value as string)
      })

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        callbacks: { onError },
      })

      actor.send({ type: "START_FIRST_SYNC" })

      await new Promise((resolve) => setTimeout(resolve, 150))

      // On failure the machine stays gated rather than entering the error state.
      expect(states).toContain("reconcilingFirstSync")
      expect(states).not.toContain("error")
      expect(actor.getSnapshot().value).toBe("awaitingInitialReconciliation")
      expect(actor.getSnapshot().context.initialReconciliationComplete).not.toBe(true)

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

      mockSyncWithProvider.mockResolvedValue({
        success: false,
        mergeResult,
        pendingConflicts: [trueConflict],
        error: "Conflicts detected",
      })

      const onConflict = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [localExpense],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
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
      mockSyncWithProvider.mockResolvedValueOnce({
        success: false,
        mergeResult: createMergeResult({ trueConflicts: [trueConflict] }),
        pendingConflicts: [trueConflict],
        error: "Conflicts detected",
      })

      // Second call (after resolution) succeeds
      const successMergeResult = createMergeResult({
        merged: [localExpense],
      })
      mockSyncWithProvider.mockResolvedValueOnce({
        success: true,
        mergeResult: successMergeResult,
      })

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
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
        initialReconciliationComplete: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("conflict")

      // Resolve conflicts
      actor.send({
        type: "RESOLVE_CONFLICTS",
        resolutions: [{ expenseId: "conflict-1", choice: "local" }],
      })

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

      mockSyncWithProvider.mockResolvedValue({
        success: false,
        mergeResult: createMergeResult({ trueConflicts: [trueConflict] }),
        pendingConflicts: [trueConflict],
        error: "Conflicts detected",
      })

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
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
    it("onSuccess callback should receive mergeResult", async () => {
      const mergedExpenses = [
        createTestExpense({ note: "Expense 1" }),
        createTestExpense({ note: "Expense 2" }),
      ]

      const mergeResult = createMergeResult({
        merged: mergedExpenses,
        addedFromRemote: [mergedExpenses[0]],
        updatedFromLocal: [mergedExpenses[1]],
      })

      mockSyncWithProvider.mockResolvedValue({
        success: true,
        mergeResult,
      })

      let receivedResult: { mergeResult?: MergeResult; isFirstSync?: boolean } | undefined

      const onSuccess: SyncCallbacks["onSuccess"] = (result) => {
        receivedResult = result
      }

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onSuccess },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedResult).toBeDefined()
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

      mockSyncWithProvider.mockResolvedValue({
        success: false,
        mergeResult: createMergeResult({ trueConflicts: [conflict1, conflict2] }),
        pendingConflicts: [conflict1, conflict2],
        error: "Conflicts detected",
      })

      let receivedConflicts: TrueConflict[] | undefined

      const onConflict: SyncCallbacks["onConflict"] = (conflicts) => {
        receivedConflicts = conflicts
      }

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
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
      mockSyncWithProvider.mockResolvedValue({
        success: false,
        error: "Failed to fetch remote expenses",
      })

      let receivedError: string | undefined

      const onError: SyncCallbacks["onError"] = (error) => {
        receivedError = error
      }

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedError).toBe("Failed to fetch remote expenses")

      actor.stop()
    })
  })

  describe("Error Handling", () => {
    it("should handle network errors during sync", async () => {
      mockSyncWithProvider.mockRejectedValue(new Error("Network error"))

      const onError = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onError).toHaveBeenCalledWith(expect.stringContaining("Network error"))

      actor.stop()
    })

    it("should allow retry from error state", async () => {
      // First call fails
      mockSyncWithProvider.mockRejectedValueOnce(new Error("Network error"))

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("error")

      // Second call succeeds (returns isInSync for quick transition through inSync)
      const mergeResult = createMergeResult({
        merged: [createTestExpense()],
      })
      mockSyncWithProvider.mockResolvedValue({
        success: true,
        mergeResult,
        isInSync: true,
      })

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 150))
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
      mockSyncWithProvider.mockResolvedValueOnce({
        success: false,
        mergeResult: createMergeResult({ trueConflicts: [trueConflict] }),
        pendingConflicts: [trueConflict],
        error: "Conflicts detected",
      })

      // Second call (after resolution) fails
      mockSyncWithProvider.mockRejectedValueOnce(
        new Error("Push failed after resolution")
      )

      const onError = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
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

  describe("Auth Error Handling", () => {
    it("should invoke onAuthError callback when errorCode is AUTH_MISSING", async () => {
      mockSyncWithProvider.mockResolvedValue({
        success: false,
        error: "Missing authentication",
        errorCode: "AUTH_MISSING",
      })

      const onAuthError = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onAuthError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onAuthError).toHaveBeenCalledWith({
        errorCode: "AUTH_MISSING",
        shouldSignOut: false,
      })

      actor.stop()
    })

    it("should invoke onAuthError with shouldSignOut=true for AUTH_INVALID", async () => {
      mockSyncWithProvider.mockResolvedValue({
        success: false,
        error: "Invalid token",
        errorCode: "AUTH_INVALID",
      })

      const onAuthError = jest.fn()
      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
        callbacks: { onAuthError },
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(actor.getSnapshot().value).toBe("error")
      expect(onAuthError).toHaveBeenCalledWith({
        errorCode: "AUTH_INVALID",
        shouldSignOut: true,
      })

      actor.stop()
    })
  })

  describe("RESET Event", () => {
    it("should reset from success state to idle", async () => {
      const mergeResult = createMergeResult({
        merged: [createTestExpense()],
      })

      mockSyncWithProvider.mockResolvedValue({
        success: true,
        mergeResult,
      })

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [createTestExpense()],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("success")

      actor.send({ type: "RESET" })
      expect(actor.getSnapshot().value).toBe("idle")

      actor.stop()
    })

    it("should reset from error state to idle", async () => {
      mockSyncWithProvider.mockRejectedValue(new Error("Failed"))

      const actor = createActor(syncMachine, {
        input: { provider: mockProvider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: [],
        syncSettingsEnabled: false,
        initialReconciliationComplete: true,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(actor.getSnapshot().value).toBe("error")

      actor.send({ type: "RESET" })
      expect(actor.getSnapshot().value).toBe("idle")

      actor.stop()
    })
  })
})
