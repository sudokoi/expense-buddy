/**
 * Integration tests for the Sync Engine Optimization (end-to-end optimized flow)
 *
 * These tests verify the full gitStyleSync implementation with:
 * - Tree-based fetch → merge → push with mocked GitHub API
 * - Fallback path: Trees API fails → Contents API succeeds → sync completes
 * - Cold start: no SHA cache → full download → cache populated
 */

// Mock i18next before imports
jest.mock("../i18n", () => ({
  __esModule: true,
  default: {
    t: (key: string, params?: any) => `${key}${params ? JSON.stringify(params) : ""}`,
  },
}))

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

import { clear, getItem, setItem } from "./storage"
import { gitStyleSync } from "./sync-manager"
import { Expense } from "../types/expense"

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_TOKEN = "ghp_test_token"
const TEST_REPO = "testowner/testrepo"
const TEST_BRANCH = "main"

/** Store sync config so gitStyleSync can load it */
async function setupSyncConfig() {
  const secureStore = require("expo-secure-store")
  secureStore.getItemAsync.mockImplementation(async (key: string) => {
    if (key === "github_pat") return TEST_TOKEN
    if (key === "github_repo") return TEST_REPO
    if (key === "github_branch") return TEST_BRANCH
    return null
  })
}

/** Create a test expense for a given day */
function makeExpense(id: string, day: string, amount: number): Expense {
  return {
    id,
    amount,
    currency: "INR",
    category: "Food",
    date: `${day}T12:00:00.000Z`,
    note: `Expense ${id}`,
    createdAt: `${day}T12:00:00.000Z`,
    updatedAt: `${day}T12:00:00.000Z`,
  }
}

/** Create CSV content for a list of expenses */
function makeCSV(expenses: Expense[]): string {
  const headers = "id,amount,currency,category,date,note,createdAt,updatedAt"
  const rows = expenses.map(
    (e) =>
      `${e.id},${e.amount},${e.currency},${e.category},${e.date},${e.note},${e.createdAt},${e.updatedAt}`
  )
  return [headers, ...rows].join("\n")
}

// ============================================================================
// GitHub API Mock Helpers
// ============================================================================

function mockBranchRef() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        object: { sha: "branch-sha-123" },
      }),
  }
}

function mockCommitTree() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        tree: { sha: "tree-sha-123" },
      }),
  }
}

function mockTreeResponse(files: Array<{ path: string; type: string; sha: string }>) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        tree: files,
        truncated: false,
      }),
  }
}

function mockDownloadCSV(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        content: Buffer.from(content).toString("base64"),
        encoding: "base64",
        sha: "blob-sha-downloaded",
      }),
  }
}

function mockBatchCommitSuccess(fileCount: number) {
  const responses: Array<{ ok: boolean; json: () => Promise<any> }> = []

  // batchCommit internally calls getBranchRef + getCommitTree first
  responses.push(mockBranchRef())
  responses.push(mockCommitTree())

  // Create blob for each file
  for (let i = 0; i < fileCount; i++) {
    responses.push({
      ok: true,
      json: () => Promise.resolve({ sha: `blob-sha-${i}` }),
    })
  }

  // Create tree
  responses.push({
    ok: true,
    json: () => Promise.resolve({ sha: "new-tree-sha" }),
  })

  // Create commit
  responses.push({
    ok: true,
    json: () => Promise.resolve({ sha: "new-commit-sha" }),
  })

  // Update ref
  responses.push({
    ok: true,
    json: () => Promise.resolve({}),
  })

  return responses
}

function mockLatestCommitTimestamp() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        commit: {
          committer: { date: new Date().toISOString() },
        },
        sha: "latest-commit-sha",
      }),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Sync Engine Integration - End-to-End Optimized Flow", () => {
  beforeEach(async () => {
    mockFetch.mockReset()
    await clear()
    await setupSyncConfig()
  })

  describe("Full fetch → merge → push with tree data", () => {
    it("should complete sync using tree-based fetch and reuse tree data in push phase", async () => {
      const localExpense = makeExpense("local-1", "2024-06-15", 25)
      const remoteExpense = makeExpense("remote-1", "2024-06-14", 50)
      const remoteCSV = makeCSV([remoteExpense])

      // Fetch phase: getBranchRef → getCommitTree → getTree
      mockFetch
        .mockResolvedValueOnce(mockBranchRef())
        .mockResolvedValueOnce(mockCommitTree())
        .mockResolvedValueOnce(
          mockTreeResponse([
            { path: "expenses-2024-06-14.csv", type: "blob", sha: "sha-day14" },
          ])
        )
        // downloadCSV for the changed file (no SHA cache → all files are "changed")
        .mockResolvedValueOnce(mockDownloadCSV(remoteCSV))

      // Push phase: batchCommit (2 files: day14 merged + day15 local)
      const batchMocks = mockBatchCommitSuccess(2)
      for (const m of batchMocks) {
        mockFetch.mockResolvedValueOnce(m)
      }

      // getLatestCommitTimestamp
      mockFetch.mockResolvedValueOnce(mockLatestCommitTimestamp())

      const result = await gitStyleSync([localExpense])

      expect(result.success).toBe(true)
      expect(result.mergeResult).toBeDefined()
      expect(result.mergeResult!.addedFromRemote.length).toBe(1)
      expect(result.mergeResult!.addedFromRemote[0].id).toBe("remote-1")
    })
  })

  describe("Cold start: no SHA cache → full download → cache populated", () => {
    it("should download all files when SHA cache is empty and populate cache after sync", async () => {
      const expense1 = makeExpense("r1", "2024-06-14", 10)
      const expense2 = makeExpense("r2", "2024-06-15", 20)
      const csv1 = makeCSV([expense1])
      const csv2 = makeCSV([expense2])

      // Fetch phase: tree API succeeds
      mockFetch
        .mockResolvedValueOnce(mockBranchRef())
        .mockResolvedValueOnce(mockCommitTree())
        .mockResolvedValueOnce(
          mockTreeResponse([
            { path: "expenses-2024-06-14.csv", type: "blob", sha: "sha-14" },
            { path: "expenses-2024-06-15.csv", type: "blob", sha: "sha-15" },
          ])
        )

      // Both files downloaded (no cache → all classified as changed)
      mockFetch
        .mockResolvedValueOnce(mockDownloadCSV(csv1))
        .mockResolvedValueOnce(mockDownloadCSV(csv2))

      // Push phase: 2 expense files
      const batchMocks = mockBatchCommitSuccess(2)
      for (const m of batchMocks) {
        mockFetch.mockResolvedValueOnce(m)
      }

      // getLatestCommitTimestamp
      mockFetch.mockResolvedValueOnce(mockLatestCommitTimestamp())

      const result = await gitStyleSync([])

      expect(result.success).toBe(true)
      expect(result.mergeResult).toBeDefined()
      expect(result.mergeResult!.addedFromRemote.length).toBe(2)

      // Verify SHA cache was saved after sync.
      const cacheRaw = await getItem("remote_sha_cache")
      expect(cacheRaw).toBeDefined()

      const savedCache = JSON.parse(cacheRaw!)
      const cachedShas = Object.values(savedCache) as string[]
      expect(cachedShas).toHaveLength(2)
      expect(cachedShas.every((s: string) => s.startsWith("blob-sha-"))).toBe(true)
    })

    it("should skip downloading unchanged files when SHA cache matches", async () => {
      const localExpense = makeExpense("r1", "2024-06-14", 10)
      const newRemoteExpense = makeExpense("r2", "2024-06-15", 20)
      const csv2 = makeCSV([newRemoteExpense])

      // SHA cache has day14 with matching SHA
      await setItem(
        "remote_sha_cache",
        JSON.stringify({ "expenses-2024-06-14.csv": "sha-14-unchanged" })
      )

      // Fetch phase: tree API returns both files
      mockFetch
        .mockResolvedValueOnce(mockBranchRef())
        .mockResolvedValueOnce(mockCommitTree())
        .mockResolvedValueOnce(
          mockTreeResponse([
            { path: "expenses-2024-06-14.csv", type: "blob", sha: "sha-14-unchanged" },
            { path: "expenses-2024-06-15.csv", type: "blob", sha: "sha-15-new" },
          ])
        )

      // Only day15 should be downloaded (day14 SHA matches cache)
      mockFetch.mockResolvedValueOnce(mockDownloadCSV(csv2))

      // Push phase
      const batchMocks = mockBatchCommitSuccess(2)
      for (const m of batchMocks) {
        mockFetch.mockResolvedValueOnce(m)
      }

      mockFetch.mockResolvedValueOnce(mockLatestCommitTimestamp())

      // Pass local expenses so unchanged files can reuse them
      const result = await gitStyleSync([localExpense])

      expect(result.success).toBe(true)
      expect(result.mergeResult).toBeDefined()

      // The fetch phase should have downloaded only 1 file (day15)
      const fetchCalls = mockFetch.mock.calls
      const contentsCalls = fetchCalls.filter(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("/contents/") &&
          !call[0].includes("/git/")
      )
      expect(contentsCalls.length).toBe(1)
      expect(contentsCalls[0][0]).toContain("expenses-2024-06-15.csv")
    })
  })
})
