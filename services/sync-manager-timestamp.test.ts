import { determineSyncDirection } from "./sync-manager"

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

import { getLatestCommitTimestamp as mockGetLatestCommitTimestamp } from "./github-sync"

describe("Sync Manager - determineSyncDirection", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStorage.clear()

    // Setup default sync config
    mockStorage.set("github_pat", "token")
    mockStorage.set("github_repo", "user/repo")
    mockStorage.set("github_branch", "main")
  })

  test("returns in_sync when timestamps match", async () => {
    const timestamp = "2024-01-01T10:00:00Z"
    mockStorage.set("last_sync_time", timestamp)
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: timestamp,
    })

    const result = await determineSyncDirection(false)

    expect(result.direction).toBe("in_sync")
    expect(result.remoteTime).toBe(timestamp)
  })

  test("returns pull when remote is newer", async () => {
    const localTime = "2024-01-01T10:00:00Z"
    const remoteTime = "2024-01-01T11:00:00Z" // 1 hour later

    mockStorage.set("last_sync_time", localTime)
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: remoteTime,
    })

    const result = await determineSyncDirection(false)

    expect(result.direction).toBe("pull")
  })

  test("returns push when local has changes and remote is same", async () => {
    const timestamp = "2024-01-01T10:00:00Z"
    mockStorage.set("last_sync_time", timestamp)
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: timestamp,
    })

    const result = await determineSyncDirection(true) // hasLocalChanges = true

    expect(result.direction).toBe("push")
  })

  test("returns conflict when both have changes", async () => {
    const localTime = "2024-01-01T10:00:00Z"
    const remoteTime = "2024-01-01T11:00:00Z" // Remote is newer

    mockStorage.set("last_sync_time", localTime)
    ;(mockGetLatestCommitTimestamp as jest.Mock).mockResolvedValue({
      timestamp: remoteTime,
    })

    const result = await determineSyncDirection(true) // hasLocalChanges = true

    expect(result.direction).toBe("conflict")
  })
})
