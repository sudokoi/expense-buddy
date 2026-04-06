/**
 * Unit tests for getRepositoryTree() error handling
 * Feature: sync-engine-optimization
 *
 * These tests verify error handling for auth errors (401/403),
 * server errors (500), network failures, and truncated tree responses.
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

import { getRepositoryTree } from "./github-sync"

/** Helper: mock a successful getBranchRef + getCommitTree, then custom tree response */
function mockBranchAndCommit() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ref: "refs/heads/main",
        object: { sha: "abc123", type: "commit" },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: "abc123",
        tree: { sha: "tree-sha" },
        message: "msg",
        parents: [],
      }),
    })
}

describe("getRepositoryTree() error handling", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("should return auth error with shouldSignOut when getBranchRef returns 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    })

    const result = await getRepositoryTree("bad-token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.authStatus).toBe(401)
    expect(result.shouldSignOut).toBe(true)
  })

  it("should return auth error with shouldSignOut when tree API returns 401", async () => {
    mockBranchAndCommit()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
      headers: new Headers(),
    })

    const result = await getRepositoryTree("bad-token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.authStatus).toBe(401)
    expect(result.shouldSignOut).toBe(true)
  })

  it("should return auth error when tree API returns 403 (permission denied)", async () => {
    mockBranchAndCommit()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Resource not accessible by integration" }),
      headers: new Headers(),
    })

    const result = await getRepositoryTree("token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.authStatus).toBe(403)
    expect(result.shouldSignOut).toBe(true)
  })

  it("should return non-auth error when tree API returns 500", async () => {
    mockBranchAndCommit()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal Server Error" }),
    })

    const result = await getRepositoryTree("token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.authStatus).toBeUndefined()
    expect(result.shouldSignOut).toBeUndefined()
    expect(result.error).toBeTruthy()
  })

  it("should return error on network failure during tree fetch", async () => {
    mockBranchAndCommit()
    mockFetch.mockRejectedValueOnce(new Error("Network request failed"))

    const result = await getRepositoryTree("token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.authStatus).toBeUndefined()
    expect(result.error).toBeTruthy()
  })

  it("should return error when tree response is truncated", async () => {
    mockBranchAndCommit()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: "tree-sha",
        tree: [{ path: "file.csv", mode: "100644", type: "blob", sha: "abc" }],
        truncated: true,
      }),
    })

    const result = await getRepositoryTree("token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe("githubSync.errors.truncatedTree")
  })

  it("should return error on network failure during getBranchRef", async () => {
    mockFetch.mockRejectedValueOnce(new Error("DNS resolution failed"))

    const result = await getRepositoryTree("token", "owner/repo", "main")

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBeTruthy()
  })

  it("should return success with blob entries on valid response", async () => {
    mockBranchAndCommit()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sha: "tree-sha",
        tree: [
          {
            path: "expenses-2024-01-15.csv",
            mode: "100644",
            type: "blob",
            sha: "aaa",
            size: 100,
          },
          { path: "subdir", mode: "040000", type: "tree", sha: "bbb" },
          {
            path: "expenses-2024-01-16.csv",
            mode: "100644",
            type: "blob",
            sha: "ccc",
            size: 200,
          },
        ],
        truncated: false,
      }),
    })

    const result = await getRepositoryTree("token", "owner/repo", "main")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.entries.length).toBe(2)
    expect(result.entries[0].path).toBe("expenses-2024-01-15.csv")
    expect(result.entries[1].path).toBe("expenses-2024-01-16.csv")
    expect(result.treeSha).toBe("tree-sha")
  })
})
