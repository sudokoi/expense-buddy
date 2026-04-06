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

import AsyncStorage from "@react-native-async-storage/async-storage"
import { gitStyleSync } from "./sync-manager"
import { Expense } from "../types/expense"

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_TOKEN = "ghp_test_token"
const TEST_REPO = "testowner/testrepo"
const TEST_BRANCH = "main"

/** Store sync config in AsyncStorage so gitStyleSync can load it */
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
    currency: "USD",
    category: "Food",
    date: `${day}T12:00:00.000Z`,
    note: `Expense ${id}`,
    createdAt: `${day}T12:00:00.000Z`,
    updatedAt: `${day}T12:00:00.000Z`,
  }
}

/** Generate CSV content from expenses (matches exportToCSV format) */
function makeCSV(expenses: Expense[]): string {
  const header =
    "id,amount,currency,category,date,note,paymentMethodType,paymentMethodId,paymentInstrumentId,createdAt,updatedAt,deletedAt"
  const rows = expenses.map(
    (e) =>
      `${e.id},${e.amount},${e.currency || "USD"},${e.category},${e.date},${e.note || ""},${e.paymentMethod?.type || ""},${e.paymentMethod?.identifier || ""},${e.paymentMethod?.instrumentId || ""},${e.createdAt},${e.updatedAt},${e.deletedAt || ""}`
  )
  return [header, ...rows].join("\n")
}

// ============================================================================
// Mock Builders
// ============================================================================

/** Mock a successful getBranchRef response */
function mockBranchRef() {
  return {
    ok: true,
    json: async () => ({
      ref: `refs/heads/${TEST_BRANCH}`,
      object: { sha: "commit-sha-abc", type: "commit" },
    }),
  }
}

/** Mock a successful getCommitTree response */
function mockCommitTree() {
  return {
    ok: true,
    json: async () => ({
      sha: "commit-sha-abc",
      tree: { sha: "tree-sha-xyz" },
      message: "latest commit",
      parents: [],
    }),
  }
}

/** Mock a successful Git Trees API response */
function mockTreeResponse(
  entries: { path: string; type: "blob" | "tree"; sha: string }[]
) {
  return {
    ok: true,
    json: async () => ({
      sha: "tree-sha-xyz",
      tree: entries.map((e) => ({
        path: e.path,
        mode: e.type === "blob" ? "100644" : "040000",
        type: e.type,
        sha: e.sha,
        size: e.type === "blob" ? 100 : undefined,
      })),
      truncated: false,
    }),
  }
}

/** Mock a successful downloadCSV (Contents API) response */
function mockDownloadCSV(content: string) {
  return {
    ok: true,
    json: async () => ({
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
      sha: "file-sha",
      name: "file.csv",
      path: "file.csv",
    }),
  }
}

/** Mock a successful listFiles (Contents API) response */
function mockListFiles(files: { name: string; path: string; sha: string }[]) {
  return {
    ok: true,
    json: async () =>
      files.map((f) => ({
        name: f.name,
        path: f.path,
        sha: f.sha,
        type: "file",
      })),
  }
}

/** Mock a successful batchCommit chain (getBranchRef → getCommitTree → createBlob(s) → createTree → createCommit → updateRef) */
function mockBatchCommitSuccess(blobCount: number) {
  const mocks: any[] = []

  // getBranchRef
  mocks.push(mockBranchRef())
  // getCommitTree
  mocks.push(mockCommitTree())

  // createBlob for each file
  for (let i = 0; i < blobCount; i++) {
    mocks.push({
      ok: true,
      json: async () => ({ sha: `blob-sha-${i}` }),
    })
  }

  // createTree
  mocks.push({
    ok: true,
    json: async () => ({ sha: "new-tree-sha" }),
  })

  // createCommit
  mocks.push({
    ok: true,
    json: async () => ({ sha: "new-commit-sha" }),
  })

  // updateRef
  mocks.push({
    ok: true,
    json: async () => ({
      ref: `refs/heads/${TEST_BRANCH}`,
      object: { sha: "new-commit-sha" },
    }),
  })

  return mocks
}

/** Mock getLatestCommitTimestamp */
function mockLatestCommitTimestamp() {
  return {
    ok: true,
    json: async () => [
      {
        sha: "new-commit-sha",
        commit: {
          committer: { date: "2024-06-15T10:00:00Z" },
        },
      },
    ],
  }
}

/** Mock a failed response */
function mockErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ message }),
    headers: new Headers(),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Sync Engine Integration - End-to-End Optimized Flow", () => {
  beforeEach(async () => {
    mockFetch.mockReset()
    ;(AsyncStorage.getItem as jest.Mock).mockReset()
    ;(AsyncStorage.setItem as jest.Mock).mockReset()
    ;(AsyncStorage.removeItem as jest.Mock).mockReset()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
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
      // Remote expense was added from remote
      expect(result.mergeResult!.addedFromRemote.length).toBe(1)
      expect(result.mergeResult!.addedFromRemote[0].id).toBe("remote-1")
      // Notification count should reflect merge result
      expect(result.remoteFilesUpdated).toBe(
        result.mergeResult!.addedFromRemote.length +
          result.mergeResult!.updatedFromRemote.length
      )
    })

    it("should report remoteFilesUpdated as 0 when no remote changes after merge", async () => {
      const expense = makeExpense("shared-1", "2024-06-15", 30)
      const remoteCSV = makeCSV([expense])

      // Fetch phase
      mockFetch
        .mockResolvedValueOnce(mockBranchRef())
        .mockResolvedValueOnce(mockCommitTree())
        .mockResolvedValueOnce(
          mockTreeResponse([
            { path: "expenses-2024-06-15.csv", type: "blob", sha: "sha-day15" },
          ])
        )
        .mockResolvedValueOnce(mockDownloadCSV(remoteCSV))

      // Push phase: file content hash won't match stored (no stored hashes),
      // so it will try to upload. Provide batchCommit mocks.
      const batchMocks = mockBatchCommitSuccess(1)
      for (const m of batchMocks) {
        mockFetch.mockResolvedValueOnce(m)
      }

      // getLatestCommitTimestamp
      mockFetch.mockResolvedValueOnce(mockLatestCommitTimestamp())

      const result = await gitStyleSync([expense])

      expect(result.success).toBe(true)
      // Same expense on both sides → merge adds nothing from remote
      expect(result.remoteFilesUpdated).toBe(0)
    })
  })

  describe("Fallback path: Trees API fails → Contents API succeeds", () => {
    it("should fall back to Contents API when tree fetch returns 500", async () => {
      const remoteExpense = makeExpense("remote-1", "2024-06-14", 50)
      const remoteCSV = makeCSV([remoteExpense])

      // Tree fetch: getBranchRef succeeds → getCommitTree succeeds → tree API returns 500
      mockFetch
        .mockResolvedValueOnce(mockBranchRef())
        .mockResolvedValueOnce(mockCommitTree())
        .mockResolvedValueOnce(mockErrorResponse(500, "Internal Server Error"))

      // Fallback: listFiles via Contents API
      mockFetch.mockResolvedValueOnce(
        mockListFiles([
          {
            name: "expenses-2024-06-14.csv",
            path: "expenses-2024-06-14.csv",
            sha: "sha-14",
          },
        ])
      )

      // downloadCSV for the file
      mockFetch.mockResolvedValueOnce(mockDownloadCSV(remoteCSV))

      // Push phase: no treeEntries from fallback, so listFiles is called again
      mockFetch.mockResolvedValueOnce(
        mockListFiles([
          {
            name: "expenses-2024-06-14.csv",
            path: "expenses-2024-06-14.csv",
            sha: "sha-14",
          },
        ])
      )

      // batchCommit (1 file: day14)
      const batchMocks = mockBatchCommitSuccess(1)
      for (const m of batchMocks) {
        mockFetch.mockResolvedValueOnce(m)
      }

      // getLatestCommitTimestamp
      mockFetch.mockResolvedValueOnce(mockLatestCommitTimestamp())

      const result = await gitStyleSync([])

      expect(result.success).toBe(true)
      expect(result.mergeResult).toBeDefined()
      expect(result.mergeResult!.addedFromRemote.length).toBe(1)
      // Fallback path should not have treeEntries, so push phase uses listFiles
      // (verified by the fact that sync completes successfully)
    })

    it("should NOT fall back on auth errors (401)", async () => {
      // Tree fetch: getBranchRef returns 401
      mockFetch.mockResolvedValueOnce(mockErrorResponse(401, "Bad credentials"))

      const result = await gitStyleSync([])

      expect(result.success).toBe(false)
      expect(result.authStatus).toBe(401)
      expect(result.shouldSignOut).toBe(true)
    })

    it("should fall back when tree response is truncated", async () => {
      const remoteExpense = makeExpense("remote-1", "2024-06-14", 50)
      const remoteCSV = makeCSV([remoteExpense])

      // Tree fetch: succeeds but truncated
      mockFetch
        .mockResolvedValueOnce(mockBranchRef())
        .mockResolvedValueOnce(mockCommitTree())
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sha: "tree-sha-xyz",
            tree: [
              {
                path: "expenses-2024-06-14.csv",
                mode: "100644",
                type: "blob",
                sha: "sha-14",
              },
            ],
            truncated: true,
          }),
        })

      // Fallback: listFiles
      mockFetch.mockResolvedValueOnce(
        mockListFiles([
          {
            name: "expenses-2024-06-14.csv",
            path: "expenses-2024-06-14.csv",
            sha: "sha-14",
          },
        ])
      )

      // downloadCSV
      mockFetch.mockResolvedValueOnce(mockDownloadCSV(remoteCSV))

      // Push phase: no treeEntries from fallback, so listFiles is called again
      mockFetch.mockResolvedValueOnce(
        mockListFiles([
          {
            name: "expenses-2024-06-14.csv",
            path: "expenses-2024-06-14.csv",
            sha: "sha-14",
          },
        ])
      )

      // batchCommit
      const batchMocks = mockBatchCommitSuccess(1)
      for (const m of batchMocks) {
        mockFetch.mockResolvedValueOnce(m)
      }

      mockFetch.mockResolvedValueOnce(mockLatestCommitTimestamp())

      const result = await gitStyleSync([])

      expect(result.success).toBe(true)
      expect(result.mergeResult!.addedFromRemote.length).toBe(1)
    })
  })

  describe("Cold start: no SHA cache → full download → cache populated", () => {
    it("should download all files when SHA cache is empty and populate cache after sync", async () => {
      const expense1 = makeExpense("r1", "2024-06-14", 10)
      const expense2 = makeExpense("r2", "2024-06-15", 20)
      const csv1 = makeCSV([expense1])
      const csv2 = makeCSV([expense2])

      // AsyncStorage: no SHA cache (default null), no file hashes, no dirty days
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)

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
      // batchCommit returns new blob SHAs for uploaded files, so the cache
      // should contain the post-push SHAs (not the pre-push tree SHAs).
      const setCalls = (AsyncStorage.setItem as jest.Mock).mock.calls
      const shaCacheCall = setCalls.find(([key]: [string]) => key === "remote_sha_cache")
      expect(shaCacheCall).toBeDefined()

      const savedCache = JSON.parse(shaCacheCall![1])
      // On cold start, both files are uploaded, so cache has new blob SHAs from batchCommit
      // (not the original tree SHAs "sha-14"/"sha-15")
      const cachedShas = Object.values(savedCache) as string[]
      expect(cachedShas).toHaveLength(2)
      expect(cachedShas.every((s: string) => s.startsWith("blob-sha-"))).toBe(true)
    })

    it("should skip downloading unchanged files when SHA cache matches", async () => {
      const localExpense = makeExpense("r1", "2024-06-14", 10)
      const newRemoteExpense = makeExpense("r2", "2024-06-15", 20)
      const csv2 = makeCSV([newRemoteExpense])

      // AsyncStorage: SHA cache has day14 with matching SHA
      ;(AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
        if (key === "remote_sha_cache") {
          return JSON.stringify({ "expenses-2024-06-14.csv": "sha-14-unchanged" })
        }
        return null
      })

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

      // The fetch phase should have downloaded only 1 file (day15),
      // reusing local expenses for day14
      // We verify by checking that only 1 downloadCSV call was made
      // (after the 3 tree-fetch calls: getBranchRef, getCommitTree, getTree)
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
