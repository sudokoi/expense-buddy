import { determineSyncDirection, mergeExpensesWithTimestamps } from "./sync-manager"
import { Expense } from "../types/expense"

// Mock dependencies
jest.mock("./github-sync", () => ({
  downloadCSV: jest.fn(),
  validatePAT: jest.fn(),
  listFiles: jest.fn(),
  batchCommit: jest.fn(),
  generateCommitMessage: jest.fn(),
  downloadSettingsFile: jest.fn(),
  getLatestCommitTimestamp: jest.fn(),
}))

jest.mock("./settings-manager", () => ({
  computeSettingsHash: jest.fn(),
  getSettingsHash: jest.fn(),
  saveSettingsHash: jest.fn(),
  clearSettingsChanged: jest.fn(),
  loadSettings: jest.fn(),
}))

jest.mock("./daily-file-manager", () => ({
  groupExpensesByDay: jest.fn(),
  getFilenameForDay: jest.fn(),
  getDayKeyFromFilename: jest.fn(),
}))

jest.mock("./hash-storage", () => ({
  computeContentHash: jest.fn(),
  loadFileHashes: jest.fn(() => ({})),
  saveFileHashes: jest.fn(),
}))

// Mock secure storage
const mockStorage = new Map<string, string>()
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async (key, value) => mockStorage.set(key, value)),
  getItemAsync: jest.fn(async (key) => mockStorage.get(key) || null),
  deleteItemAsync: jest.fn(async (key) => mockStorage.delete(key)),
}))
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(async (key, value) => mockStorage.set(key, value)),
  getItem: jest.fn(async (key) => mockStorage.get(key) || null),
  removeItem: jest.fn(async (key) => mockStorage.delete(key)),
}))
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }))

import { getLatestCommitTimestamp as mockGetLatestCommitTimestamp } from "./github-sync"

describe("Sync Logic Reproduction", () => {
  const commonDate = "2024-01-01T12:00:00.000Z"
  const sampleExpense: Expense = {
    id: "1",
    amount: 100,
    category: "Food",
    date: "2024-01-01",
    note: "Lunch",
    createdAt: commonDate,
    updatedAt: commonDate,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockStorage.clear()
    mockStorage.set("github_pat", "token")
    mockStorage.set("github_repo", "user/repo")
    mockStorage.set("github_branch", "main")
  })

  test("Reproduce Bug 1: Should NOT report updates if remote is identical", async () => {
    // Setup: Local has 1 expense. Remote has same expense.
    // Last sync time is set.
    const lastSyncTime = "2024-01-02T10:00:00Z"

    // Remote expense matches local exactly
    const remoteExpenses = [sampleExpense]
    const localExpenses = [sampleExpense]

    // Use mergeExpensesWithTimestamps directly (since autoSync is removed)
    // This was the core logic inside autoSync that caused the bug
    const result = mergeExpensesWithTimestamps(
      localExpenses,
      remoteExpenses,
      lastSyncTime
    )

    // Expectation: Should NOT report "1 expense synced" if content is identical
    // If bug exists, one of them > 0
    console.log("Stats:", {
      new: result.newFromRemote,
      updated: result.updatedFromRemote,
    })

    // Both should be 0 because the expenses are identical
    expect(result.newFromRemote).toBe(0)
    expect(result.updatedFromRemote).toBe(0)
  })

  test("Reproduce Bug 2: Conflict reported when adding new expense locally", async () => {
    // Setup: Last sync time Matches remote time EXACTLY.
    const lastSyncTime = "2024-01-02T10:00:00Z"
    mockStorage.set("last_sync_time", lastSyncTime)

    // Remote commit time matches last sync time
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: lastSyncTime,
    })

    // We have local changes (simulated by passing true to determineSyncDirection)
    const hasLocalChanges = true

    // Run determineSyncDirection
    const result = await determineSyncDirection(hasLocalChanges)

    // Expectation: Should be "push" because remote hasn't changed since last sync
    // If it returns "conflict", that's the bug.
    expect(result.direction).toBe("push")
  })
})
