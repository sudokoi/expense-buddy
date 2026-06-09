/**
 * Tests for the GitHub provider's out-of-range deletion guard.
 *
 * Regression coverage for the audit finding: the guard used to infer the
 * "covered date range" from the upload snapshot's own content files, so a
 * delete-only batch (no content files) had a null range and dropped EVERY
 * deletion. The fix threads the full local/merged data span via
 * `snapshot.coveredDayRange`; the guard honors in-range deletions and still
 * drops out-of-range ones.
 */
import type {
  GitHubProviderConfig,
  CredentialStore,
  SyncSnapshot,
} from "../provider-types"

jest.mock("../../github-sync", () => ({
  getRepositoryTree: jest.fn(),
  downloadCSV: jest.fn(),
  downloadSettingsFile: jest.fn(),
  batchCommit: jest.fn(),
  validatePAT: jest.fn(),
  GitHubApiError: class GitHubApiError extends Error {},
  generateCommitMessage: jest.fn(() => "commit message"),
}))

import { batchCommit, getRepositoryTree } from "../../github-sync"
import { GitHubProvider } from "../github-provider"

const mockCredentialStore: CredentialStore = {
  get: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
}

function createConfig(): GitHubProviderConfig {
  return {
    kind: "github",
    id: "test-github",
    label: "Test GitHub",
    credentialId: "gh-creds",
    repo: "owner/repo",
    branch: "main",
  }
}

function makeSnapshot(
  files: Record<string, string>,
  coveredDayRange?: { oldest: string; newest: string } | null
): SyncSnapshot {
  return {
    manifest: { version: 1, generatedAt: "", appVersion: "test", files: [] },
    files,
    remoteRevision: null,
    coveredDayRange: coveredDayRange ?? null,
  }
}

describe("GitHubProvider deletion range guard", () => {
  let provider: GitHubProvider

  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockCredentialStore.get as jest.Mock).mockResolvedValue({
      credentialId: "gh-creds",
      kind: "github_pat",
      data: { token: "test-token" },
    })
    ;(batchCommit as jest.Mock).mockResolvedValue({ success: true })
    provider = new GitHubProvider(createConfig(), mockCredentialStore)
  })

  it("honors a delete-only batch when coveredDayRange marks the day in range", async () => {
    // No content files in the batch — only a deletion. The covered range comes
    // from the full local data, so the deletion is inside the range and kept.
    const snapshot = makeSnapshot(
      { "expenses-2024-06-15.csv": "" },
      { oldest: "2024-01-01", newest: "2024-12-31" }
    )

    await provider.writeSnapshot(snapshot, null)

    expect(batchCommit).toHaveBeenCalledTimes(1)
    const request = (batchCommit as jest.Mock).mock.calls[0][3]
    expect(request.deletions).toEqual([{ path: "expenses-2024-06-15.csv" }])
    expect(request.uploads).toEqual([])
  })

  it("drops a deletion that falls outside the covered range", async () => {
    const snapshot = makeSnapshot(
      { "expenses-2020-01-01.csv": "" },
      { oldest: "2024-01-01", newest: "2024-12-31" }
    )

    await provider.writeSnapshot(snapshot, null)

    const request = (batchCommit as jest.Mock).mock.calls[0][3]
    expect(request.deletions).toEqual([])
  })

  it("falls back to inferring the range from content files when coveredDayRange is absent", async () => {
    // Mixed batch, no explicit range: the in-range deletion (between the content
    // days) is kept; the out-of-range one is dropped.
    const snapshot = makeSnapshot({
      "expenses-2024-06-01.csv": "id,amount\n1,100",
      "expenses-2024-06-10.csv": "id,amount\n2,200",
      "expenses-2024-06-05.csv": "", // in range -> kept
      "expenses-2030-01-01.csv": "", // out of range -> dropped
    })

    await provider.writeSnapshot(snapshot, null)

    const request = (batchCommit as jest.Mock).mock.calls[0][3]
    expect(request.deletions).toEqual([{ path: "expenses-2024-06-05.csv" }])
    expect(request.uploads).toHaveLength(2)
  })

  it("rejects a stale write with CONFLICT and does not commit", async () => {
    ;(getRepositoryTree as jest.Mock).mockResolvedValue({
      success: true,
      treeSha: "advanced-sha",
    })

    const snapshot = makeSnapshot({ "expenses-2024-06-01.csv": "id,amount\n1,100" })

    await expect(
      provider.writeSnapshot(snapshot, { kind: "git_sha", sha: "original-sha" })
    ).rejects.toMatchObject({ code: "CONFLICT", retryable: false })

    expect(batchCommit).not.toHaveBeenCalled()
  })

  it("fails with NETWORK (no commit) when the OCC re-read fails", async () => {
    // We held a known revision but couldn't re-read the remote to verify it:
    // the write must not proceed blind.
    ;(getRepositoryTree as jest.Mock).mockResolvedValue({
      success: false,
      error: "transient",
    })

    const snapshot = makeSnapshot({ "expenses-2024-06-01.csv": "id,amount\n1,100" })

    await expect(
      provider.writeSnapshot(snapshot, { kind: "git_sha", sha: "original-sha" })
    ).rejects.toMatchObject({ code: "NETWORK", retryable: true })

    expect(batchCommit).not.toHaveBeenCalled()
  })
})
