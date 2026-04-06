/**
 * Property-based tests for GitHub Sync - Repository Tree
 * Feature: sync-engine-optimization
 */

import * as fc from "fast-check"

// Mock i18next before imports
jest.mock("../i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

import { getRepositoryTree, RepositoryTreeEntry } from "./github-sync"

/**
 * Property 1: Tree Parsing Extracts All Blob Entries
 * For any Git Trees API response with mixed blob/tree entries,
 * getRepositoryTree() SHALL return exactly the entries with type === "blob",
 * each containing the correct path and sha, and no tree-type entries.
 */
describe("Property 1: Tree Parsing Extracts All Blob Entries", () => {
  const shaArb = fc.stringMatching(/^[0-9a-f]{40}$/)
  const pathArb = fc.stringMatching(/^[a-z0-9\-/.]{1,50}$/)

  const blobEntryArb = fc.record({
    path: pathArb,
    mode: fc.constant("100644"),
    type: fc.constant("blob" as const),
    sha: shaArb,
    size: fc.option(fc.nat({ max: 100000 }), { nil: undefined }),
  })

  const treeEntryArb = fc.record({
    path: pathArb,
    mode: fc.constant("040000"),
    type: fc.constant("tree" as const),
    sha: shaArb,
  })

  const mixedTreeArb = fc.tuple(
    fc.array(blobEntryArb, { minLength: 0, maxLength: 20 }),
    fc.array(treeEntryArb, { minLength: 0, maxLength: 10 })
  )

  /** Helper to set up mocks for a successful tree fetch */
  function mockSuccessfulTreeFetch(treeEntries: any[]) {
    mockFetch
      // getBranchRef
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: "refs/heads/main",
          object: { sha: "commit-sha", type: "commit" },
        }),
      })
      // getCommitTree
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "commit-sha",
          tree: { sha: "tree-sha" },
          message: "msg",
          parents: [],
        }),
      })
      // GET /git/trees
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: "tree-sha", tree: treeEntries, truncated: false }),
      })
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("returned entries SHALL contain only blob-type entries with correct path and sha", async () => {
    await fc.assert(
      fc.asyncProperty(mixedTreeArb, async ([blobs, trees]) => {
        const allEntries = [...blobs, ...trees]
        // Sort deterministically so failures remain reproducible and shrinkable
        const shuffled = [...allEntries].sort((a, b) =>
          `${a.type}:${a.path}:${a.sha}`.localeCompare(`${b.type}:${b.path}:${b.sha}`)
        )

        mockSuccessfulTreeFetch(shuffled)

        const result = await getRepositoryTree("token", "owner/repo", "main")

        expect(result.success).toBe(true)
        if (!result.success) return

        // Every returned entry must be a blob
        for (const entry of result.entries) {
          expect(entry.type).toBe("blob")
        }

        // Count must match the number of blob inputs
        expect(result.entries.length).toBe(blobs.length)

        // Each blob from input must appear in the result with correct path and sha
        for (const blob of blobs) {
          const found = result.entries.find(
            (e: RepositoryTreeEntry) => e.path === blob.path && e.sha === blob.sha
          )
          expect(found).toBeDefined()
        }
      }),
      { numRuns: 100 }
    )
  })

  it("SHALL return no entries when tree contains only directory entries", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(treeEntryArb, { minLength: 1, maxLength: 10 }),
        async (trees) => {
          mockSuccessfulTreeFetch(trees)

          const result = await getRepositoryTree("token", "owner/repo", "main")

          expect(result.success).toBe(true)
          if (!result.success) return
          expect(result.entries.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("SHALL return all entries when tree contains only blob entries", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(blobEntryArb, { minLength: 1, maxLength: 20 }),
        async (blobs) => {
          mockSuccessfulTreeFetch(blobs)

          const result = await getRepositoryTree("token", "owner/repo", "main")

          expect(result.success).toBe(true)
          if (!result.success) return
          expect(result.entries.length).toBe(blobs.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})
