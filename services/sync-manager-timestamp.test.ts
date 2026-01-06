import { autoSync, determineSyncDirection } from "./sync-manager"

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
  groupExpensesByDay: jest.fn(() => new Map()),
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

import {
  getLatestCommitTimestamp as mockGetLatestCommitTimestamp,
  batchCommit as mockBatchCommit,
} from "./github-sync"

describe("Sync Manager Timestamp Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStorage.clear()

    // Setup default sync config
    mockStorage.set("github_pat", "token")
    mockStorage.set("github_repo", "user/repo")
    mockStorage.set("github_branch", "main")
  })

  test("autoSync uses server timestamp when commit is made", async () => {
    // Setup mocks to force a commit (deletion of remote file)
    const remoteTimestamp = "2024-01-02T12:00:00Z"

    // 1. Mock listFiles to return a file that doesn't exist locally (triggers deletion)
    const { listFiles } = require("./github-sync")
    listFiles.mockResolvedValue([
      {
        name: "expenses-2023-01-01.csv",
        path: "expenses-2023-01-01.csv",
        size: 100,
        sha: "abc",
        type: "file",
      },
    ])

    // 2. Mock daily-file-manager to return valid day key for the file
    const { getDayKeyFromFilename } = require("./daily-file-manager")
    getDayKeyFromFilename.mockReturnValue("2023-01-01")
    // groupExpensesByDay returns empty map by default mock, so local is empty -> deletion triggered

    // 3. Mock batchCommit to succeed
    ;(mockBatchCommit as jest.Mock).mockResolvedValue({
      success: true,
      commitSha: "new-sha",
    })

    // 4. Mock getLatestCommitTimestamp to return authoritative time
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: remoteTimestamp,
    })

    // 5. Mock syncDown (called by autoSync first)
    const { downloadCSV, downloadSettingsFile } = require("./github-sync")
    downloadCSV.mockResolvedValue({ content: "", sha: "123" }) // return empty content
    downloadSettingsFile.mockResolvedValue(null)

    // We need to ensure syncDown doesn't fail. It lists files too.
    // If we return files in listFiles, syncDown will try to download them.
    // Let's make syncDown succeed but return no expenses so merge is simple.

    // Run autoSync
    await autoSync([], undefined, false)

    // Verify storage has the authoritative timestamp (from getLatestCommitTimestamp)
    const storedTime = mockStorage.get("last_sync_time")
    expect(storedTime).toBe(remoteTimestamp)
  })

  test("determineSyncDirection returns in_sync when timestamps match", async () => {
    const timestamp = "2024-01-01T10:00:00Z"
    mockStorage.set("last_sync_time", timestamp)
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: timestamp,
    })

    const result = await determineSyncDirection(false)

    expect(result.direction).toBe("in_sync")
    expect(result.remoteTime).toBe(timestamp)
  })

  test("determineSyncDirection returns pull when remote is newer", async () => {
    const localTime = "2024-01-01T10:00:00Z"
    const remoteTime = "2024-01-01T11:00:00Z" // 1 hour later

    mockStorage.set("last_sync_time", localTime)
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: remoteTime,
    })

    const result = await determineSyncDirection(false)

    expect(result.direction).toBe("pull")
  })
})
