/**
 * GitHub API client for syncing expense data
 */

interface GitHubFileResponse {
  content: string
  sha: string
}

interface GitHubCommitRequest {
  message: string
  content: string
  sha?: string
}

// Batch commit types for atomic multi-file operations

/** File to be uploaded in a batch commit */
export interface BatchFileUpload {
  path: string // e.g., "expenses-2024-01-15.csv"
  content: string // CSV content
}

/** File to be deleted in a batch commit */
export interface BatchFileDelete {
  path: string // e.g., "expenses-2024-01-10.csv"
}

/** Request for a batch commit operation */
export interface BatchCommitRequest {
  uploads: BatchFileUpload[]
  deletions: BatchFileDelete[]
  message: string
}

/** Result of a batch commit operation */
export interface BatchCommitResult {
  success: boolean
  commitSha?: string
  error?: string
  errorCode?: "AUTH" | "PERMISSION" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT" | "UNKNOWN"
}

/**
 * Generate a commit message for batch operations
 * @param uploads Number of files being uploaded
 * @param deletions Number of files being deleted
 * @returns Formatted commit message
 */
export function generateCommitMessage(uploads: number, deletions: number): string {
  const parts: string[] = []

  if (uploads > 0) {
    parts.push(`${uploads} file${uploads > 1 ? "s" : ""} updated`)
  }

  if (deletions > 0) {
    parts.push(`${deletions} file${deletions > 1 ? "s" : ""} deleted`)
  }

  if (parts.length === 0) {
    return `Sync expenses - ${new Date().toISOString()}`
  }

  const timestamp = new Date().toISOString()
  return `Sync expenses: ${parts.join(", ")} - ${timestamp}`
}

// ============================================================================
// Git Data API Functions for Batch Commits
// ============================================================================

/** Response from GET /repos/{owner}/{repo}/git/ref/heads/{branch} */
interface GitRefResponse {
  ref: string
  object: {
    sha: string
    type: string
  }
}

/** Response from GET /repos/{owner}/{repo}/git/commits/{sha} */
interface GitCommitResponse {
  sha: string
  tree: {
    sha: string
  }
  message: string
  parents: { sha: string }[]
}

/** Response from POST /repos/{owner}/{repo}/git/blobs */
interface GitBlobResponse {
  sha: string
}

/** Tree entry for creating a new tree */
interface TreeEntry {
  path: string
  mode: "100644" | "100755" | "040000" | "160000" | "120000"
  type: "blob" | "tree" | "commit"
  sha: string | null // null for deletions
}

/** Response from POST /repos/{owner}/{repo}/git/trees */
interface GitTreeResponse {
  sha: string
  tree: TreeEntry[]
}

/** Response from POST /repos/{owner}/{repo}/git/commits */
interface GitNewCommitResponse {
  sha: string
  tree: { sha: string }
  message: string
}

/**
 * Map HTTP status codes to user-friendly error messages and codes
 */
function mapHttpError(
  status: number,
  message?: string
): { error: string; errorCode: BatchCommitResult["errorCode"] } {
  switch (status) {
    case 401:
      return { error: "Invalid or expired token", errorCode: "AUTH" }
    case 403:
      return {
        error: message?.includes("rate limit")
          ? "Rate limit exceeded - try again later"
          : "Token lacks required permissions",
        errorCode: message?.includes("rate limit") ? "RATE_LIMIT" : "PERMISSION",
      }
    case 404:
      return {
        error: "Repository or branch not found",
        errorCode: "NOT_FOUND",
      }
    case 409:
      return {
        error: "Conflict - branch may have been updated",
        errorCode: "CONFLICT",
      }
    case 422:
      return {
        error: message
          ? `Invalid request: ${message}`
          : "Invalid request - check file paths",
        errorCode: "UNKNOWN",
      }
    case 429:
      return {
        error: "Rate limit exceeded - try again later",
        errorCode: "RATE_LIMIT",
      }
    default:
      return {
        error: message || `GitHub API error (${status})`,
        errorCode: "UNKNOWN",
      }
  }
}

/**
 * Get the current branch reference (HEAD SHA)
 * GET /repos/{owner}/{repo}/git/ref/heads/{branch}
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param branch Branch name
 * @returns The SHA of the current commit on the branch, or error
 */
export async function getBranchRef(
  token: string,
  repo: string,
  branch: string
): Promise<
  { sha: string } | { error: string; errorCode: BatchCommitResult["errorCode"] }
> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format", errorCode: "UNKNOWN" }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return mapHttpError(response.status, errorData.message)
    }

    const data: GitRefResponse = await response.json()
    return { sha: data.object.sha }
  } catch (error) {
    return { error: `Network error: ${error}`, errorCode: "UNKNOWN" }
  }
}

/**
 * Get the tree SHA from a commit
 * GET /repos/{owner}/{repo}/git/commits/{sha}
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param commitSha The SHA of the commit
 * @returns The SHA of the tree associated with the commit, or error
 */
export async function getCommitTree(
  token: string,
  repo: string,
  commitSha: string
): Promise<
  { treeSha: string } | { error: string; errorCode: BatchCommitResult["errorCode"] }
> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format", errorCode: "UNKNOWN" }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits/${commitSha}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return mapHttpError(response.status, errorData.message)
    }

    const data: GitCommitResponse = await response.json()
    return { treeSha: data.tree.sha }
  } catch (error) {
    return { error: `Network error: ${error}`, errorCode: "UNKNOWN" }
  }
}

/**
 * Create a blob for file content
 * POST /repos/{owner}/{repo}/git/blobs
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param content The file content (will be base64 encoded)
 * @returns The SHA of the created blob, or error
 */
export async function createBlob(
  token: string,
  repo: string,
  content: string
): Promise<
  { sha: string } | { error: string; errorCode: BatchCommitResult["errorCode"] }
> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format", errorCode: "UNKNOWN" }
    }

    // Base64 encode the content
    const encodedContent = btoa(unescape(encodeURIComponent(content)))

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          content: encodedContent,
          encoding: "base64",
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return mapHttpError(response.status, errorData.message)
    }

    const data: GitBlobResponse = await response.json()
    return { sha: data.sha }
  } catch (error) {
    return { error: `Network error: ${error}`, errorCode: "UNKNOWN" }
  }
}

/**
 * Create a tree with file changes
 * POST /repos/{owner}/{repo}/git/trees
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param baseTreeSha The SHA of the base tree to build upon
 * @param entries Array of tree entries (uploads with blob SHA, deletions with sha: null)
 * @returns The SHA of the created tree, or error
 */
export async function createTree(
  token: string,
  repo: string,
  baseTreeSha: string,
  entries: { path: string; sha: string | null }[]
): Promise<
  { sha: string } | { error: string; errorCode: BatchCommitResult["errorCode"] }
> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format", errorCode: "UNKNOWN" }
    }

    // Build tree entries - for deletions, sha is null; for uploads, sha is the blob SHA
    const treeEntries = entries.map((entry) => ({
      path: entry.path,
      mode: "100644" as const, // Regular file
      type: "blob" as const,
      sha: entry.sha, // null for deletions, blob SHA for uploads
    }))

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return mapHttpError(response.status, errorData.message)
    }

    const data: GitTreeResponse = await response.json()
    return { sha: data.sha }
  } catch (error) {
    return { error: `Network error: ${error}`, errorCode: "UNKNOWN" }
  }
}

/**
 * Create a commit pointing to a tree
 * POST /repos/{owner}/{repo}/git/commits
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param message Commit message
 * @param treeSha The SHA of the tree for this commit
 * @param parentSha The SHA of the parent commit
 * @returns The SHA of the created commit, or error
 */
export async function createCommit(
  token: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<
  { sha: string } | { error: string; errorCode: BatchCommitResult["errorCode"] }
> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format", errorCode: "UNKNOWN" }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message,
          tree: treeSha,
          parents: [parentSha],
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return mapHttpError(response.status, errorData.message)
    }

    const data: GitNewCommitResponse = await response.json()
    return { sha: data.sha }
  } catch (error) {
    return { error: `Network error: ${error}`, errorCode: "UNKNOWN" }
  }
}

/**
 * Update a branch reference to point to a new commit
 * PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param branch Branch name
 * @param commitSha The SHA of the commit to point to
 * @returns Success or error
 */
export async function updateRef(
  token: string,
  repo: string,
  branch: string,
  commitSha: string
): Promise<
  { success: true } | { error: string; errorCode: BatchCommitResult["errorCode"] }
> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format", errorCode: "UNKNOWN" }
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          sha: commitSha,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return mapHttpError(response.status, errorData.message)
    }

    return { success: true }
  } catch (error) {
    return { error: `Network error: ${error}`, errorCode: "UNKNOWN" }
  }
}

// ============================================================================
// Main Batch Commit Function
// ============================================================================

/**
 * Create a single commit with multiple file changes
 * Uses GitHub Git Data API: getBranchRef → getCommitTree → createBlobs → createTree → createCommit → updateRef
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param branch Branch name
 * @param request Batch commit request containing uploads and deletions
 * @returns Result with success status and commit SHA or error
 */
export async function batchCommit(
  token: string,
  repo: string,
  branch: string,
  request: BatchCommitRequest
): Promise<BatchCommitResult> {
  const { uploads, deletions, message } = request

  // Handle empty batch case - return early with success
  if (uploads.length === 0 && deletions.length === 0) {
    return { success: true }
  }

  // Step 1: Get current branch ref (HEAD SHA)
  const refResult = await getBranchRef(token, repo, branch)
  if ("error" in refResult) {
    return {
      success: false,
      error: refResult.error,
      errorCode: refResult.errorCode,
    }
  }
  const headSha = refResult.sha

  // Step 2: Get base tree SHA from commit
  const treeResult = await getCommitTree(token, repo, headSha)
  if ("error" in treeResult) {
    return {
      success: false,
      error: treeResult.error,
      errorCode: treeResult.errorCode,
    }
  }
  const baseTreeSha = treeResult.treeSha

  function sanitizePath(path: string): string {
    return path.replace(/^\/+/, "")
  }

  // Step 3: Create blobs for each file to upload
  const treeEntries: { path: string; sha: string | null }[] = []

  for (const upload of uploads) {
    const blobResult = await createBlob(token, repo, upload.content)
    if ("error" in blobResult) {
      return {
        success: false,
        error: `Failed to create blob for ${upload.path}: ${blobResult.error}`,
        errorCode: blobResult.errorCode,
      }
    }
    treeEntries.push({ path: sanitizePath(upload.path), sha: blobResult.sha })
  }

  // Step 4: Add deletions to tree entries (sha: null marks deletion)
  for (const deletion of deletions) {
    treeEntries.push({ path: sanitizePath(deletion.path), sha: null })
  }

  // Step 5: Create new tree with all changes
  const newTreeResult = await createTree(token, repo, baseTreeSha, treeEntries)
  if ("error" in newTreeResult) {
    return {
      success: false,
      error: newTreeResult.error,
      errorCode: newTreeResult.errorCode,
    }
  }
  const newTreeSha = newTreeResult.sha

  // Step 6: Create commit pointing to new tree
  const commitResult = await createCommit(token, repo, message, newTreeSha, headSha)
  if ("error" in commitResult) {
    return {
      success: false,
      error: commitResult.error,
      errorCode: commitResult.errorCode,
    }
  }
  const newCommitSha = commitResult.sha

  // Step 7: Update branch ref to new commit
  const updateResult = await updateRef(token, repo, branch, newCommitSha)
  if ("error" in updateResult) {
    return {
      success: false,
      error: updateResult.error,
      errorCode: updateResult.errorCode,
    }
  }

  return {
    success: true,
    commitSha: newCommitSha,
  }
}

// ============================================================================
// Existing Functions
// ============================================================================

/**
 * Get the timestamp of the latest commit on the branch
 * Uses the commits API to get the most recent commit date
 *
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param branch Branch name
 * @returns The ISO timestamp of the latest commit, or null if unable to fetch
 */
export async function getLatestCommitTimestamp(
  token: string,
  repo: string,
  branch: string
): Promise<{ timestamp: string } | { error: string }> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { error: "Invalid repository format" }
    }

    // Get the latest commit on the branch
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/commits?sha=${branch}&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )

    if (!response.ok) {
      // Provide user-friendly error messages for common scenarios
      switch (response.status) {
        case 401:
          return { error: "Invalid or expired GitHub token" }
        case 403:
          return { error: "GitHub rate limit exceeded or access denied" }
        case 404:
          return { error: "Repository or branch not found" }
        case 500:
        case 502:
        case 503:
          return { error: "GitHub is temporarily unavailable. Try again later." }
        default:
          return { error: `GitHub sync failed (${response.status})` }
      }
    }

    const commits = await response.json()

    if (!Array.isArray(commits) || commits.length === 0) {
      // No commits on this branch - treat as fresh repo
      return { timestamp: new Date(0).toISOString() }
    }

    // Return the commit timestamp (author date)
    const latestCommit = commits[0]
    const timestamp =
      latestCommit.commit?.author?.date || latestCommit.commit?.committer?.date

    if (!timestamp) {
      return { error: "Could not extract timestamp from commit" }
    }

    return { timestamp }
  } catch (error) {
    // Check for specific network error types
    const errorMessage = String(error)
    if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("Network request failed") ||
      errorMessage.includes("TypeError")
    ) {
      return { error: "No internet connection. Sync will retry when online." }
    }
    return { error: `Sync failed: ${error}` }
  }
}

/**
 * Validate GitHub token and repository access.
 *
 * Requirements enforced:
 * - Repository must be owned by the authenticated user (personal repos only)
 * - Authenticated user must have write/push access to the repo
 */
export async function validatePAT(
  token: string,
  repo: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return {
        valid: false,
        error: "Invalid repository format. Use: username/repo",
      }
    }

    const commonHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }

    // 1) Validate token + determine viewer login (used to enforce personal-only repos)
    const userResponse = await fetch("https://api.github.com/user", {
      headers: commonHeaders,
    })

    if (userResponse.status === 401) {
      return { valid: false, error: "Invalid or expired GitHub token" }
    }

    if (userResponse.status === 403) {
      return {
        valid: false,
        error: "Access forbidden. Please allow repository access.",
      }
    }

    if (!userResponse.ok) {
      const errorData = await userResponse.json().catch(() => ({}))
      return {
        valid: false,
        error: `GitHub API error (${userResponse.status}): ${
          errorData.message || userResponse.statusText
        }`,
      }
    }

    const userData = (await userResponse.json().catch(() => null)) as {
      login?: string
    } | null

    const viewerLogin = String(userData?.login || "").trim()
    if (!viewerLogin) {
      return { valid: false, error: "Could not determine GitHub username" }
    }

    // Enforce personal-only repos: owner must match the authenticated user
    if (owner.toLowerCase() !== viewerLogin.toLowerCase()) {
      return {
        valid: false,
        error:
          "Organization repositories aren’t supported yet. Choose a personal repo you own.",
      }
    }

    console.log(
      "Testing connection to:",
      `https://api.github.com/repos/${owner}/${repoName}`
    )

    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: commonHeaders,
    })

    console.log("GitHub API Response status:", response.status)

    if (response.status === 404) {
      return {
        valid: false,
        error:
          "Repository not found or token lacks access. Check: 1) Repo name is correct 2) Token has Contents permission 3) Token can access this specific repo",
      }
    }

    if (response.status === 401) {
      return {
        valid: false,
        error: "Invalid or expired GitHub token",
      }
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}))
      console.log("403 Error details:", errorData)
      return {
        valid: false,
        error:
          "Access forbidden. Token may lack required permissions (Contents: Read and Write)",
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.log("API Error:", errorData)
      return {
        valid: false,
        error: `GitHub API error (${response.status}): ${
          errorData.message || response.statusText
        }`,
      }
    }

    const repoData = (await response.json().catch(() => null)) as {
      full_name?: string
      permissions?: {
        admin?: boolean
        maintain?: boolean
        push?: boolean
      }
    } | null

    console.log("Repository found:", repoData?.full_name)

    // 2) Verify write/push access
    const hasPushViaRepo = Boolean(
      repoData?.permissions?.push ||
      repoData?.permissions?.admin ||
      repoData?.permissions?.maintain
    )

    if (!hasPushViaRepo) {
      // Fallback: collaborator permission endpoint (more explicit)
      const permissionResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/collaborators/${encodeURIComponent(
          viewerLogin
        )}/permission`,
        { headers: commonHeaders }
      )

      if (permissionResponse.ok) {
        const permissionData = (await permissionResponse.json().catch(() => null)) as {
          permission?: string
        } | null
        const permission = String(permissionData?.permission || "").toLowerCase()
        const hasPushViaPermission =
          permission === "admin" || permission === "maintain" || permission === "write"

        if (!hasPushViaPermission) {
          return {
            valid: false,
            error:
              "No write access to this repository. Please choose a repo you can push to.",
          }
        }
      } else {
        return {
          valid: false,
          error:
            "No write access to this repository. Please choose a repo you can push to.",
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error("Connection test error:", error)
    return { valid: false, error: `Network error: ${error}` }
  }
}

/**
 * Upload CSV content to GitHub repository
 */
export async function uploadCSV(
  token: string,
  repo: string,
  branch: string,
  csvContent: string,
  filePath: string = "expenses.csv"
): Promise<{ success: boolean; error?: string }> {
  try {
    const [owner, repoName] = repo.split("/")
    const encodedContent = btoa(unescape(encodeURIComponent(csvContent)))

    // First, try to get existing file SHA
    let existingSHA: string | undefined
    try {
      const fileData = await downloadCSV(token, repo, branch, filePath)
      if (fileData) {
        existingSHA = fileData.sha
      }
    } catch {
      // File doesn't exist, that's okay
    }

    const requestBody: GitHubCommitRequest = {
      message: `Update expenses - ${new Date().toISOString()}`,
      content: encodedContent,
    }

    if (existingSHA) {
      requestBody.sha = existingSHA
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...requestBody,
          branch,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.message || response.statusText,
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: `Upload failed: ${error}` }
  }
}

/**
 * Download CSV content from GitHub repository
 */
export async function downloadCSV(
  token: string,
  repo: string,
  branch: string,
  filePath: string = "expenses.csv"
): Promise<{ content: string; sha: string } | null> {
  try {
    const [owner, repoName] = repo.split("/")

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    )

    if (response.status === 404) {
      // File doesn't exist yet
      return null
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`)
    }

    const data: GitHubFileResponse = await response.json()
    const decodedContent = decodeURIComponent(
      escape(atob(data.content.replace(/\n/g, "")))
    )

    return {
      content: decodedContent,
      sha: data.sha,
    }
  } catch (error) {
    console.error("Download CSV error:", error)
    throw error
  }
}

/**
 * List all files in a directory in the GitHub repository
 */
export async function listFiles(
  token: string,
  repo: string,
  branch: string,
  path: string = ""
): Promise<{ name: string; path: string; sha: string }[]> {
  try {
    const [owner, repoName] = repo.split("/")

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    )

    if (response.status === 404) {
      // Directory doesn't exist yet
      return []
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`)
    }

    const data = await response.json()

    // Filter for files only (not directories)
    if (Array.isArray(data)) {
      return data
        .filter((item: any) => item.type === "file")
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
        }))
    }

    return []
  } catch (error) {
    console.error("List files error:", error)
    return []
  }
}

/**
 * Delete a file from GitHub repository
 */
export async function deleteFile(
  token: string,
  repo: string,
  branch: string,
  filePath: string,
  sha: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [owner, repoName] = repo.split("/")

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Delete ${filePath} - ${new Date().toISOString()}`,
          sha,
          branch,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.message || response.statusText,
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: `Delete failed: ${error}` }
  }
}

// ============================================================================
// Settings Sync Functions
// ============================================================================

const SETTINGS_FILE_PATH = "settings.json"

/**
 * Upload settings.json to GitHub repository
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param branch Branch name
 * @param settingsContent JSON string of settings
 * @returns Result with success status or error
 */
export async function uploadSettingsFile(
  token: string,
  repo: string,
  branch: string,
  settingsContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      return { success: false, error: "Invalid repository format" }
    }

    const encodedContent = btoa(unescape(encodeURIComponent(settingsContent)))

    // First, try to get existing file SHA
    let existingSHA: string | undefined
    try {
      const existingFile = await downloadSettingsFile(token, repo, branch)
      if (existingFile) {
        existingSHA = existingFile.sha
      }
    } catch {
      // File doesn't exist, that's okay
    }

    const requestBody: {
      message: string
      content: string
      branch: string
      sha?: string
    } = {
      message: `Update settings - ${new Date().toISOString()}`,
      content: encodedContent,
      branch,
    }

    if (existingSHA) {
      requestBody.sha = existingSHA
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${SETTINGS_FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || response.statusText,
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: `Upload settings failed: ${error}` }
  }
}

/**
 * Download settings.json from GitHub repository
 * @param token GitHub Personal Access Token
 * @param repo Repository in format "owner/repo"
 * @param branch Branch name
 * @returns Settings content and SHA, or null if file doesn't exist
 */
export async function downloadSettingsFile(
  token: string,
  repo: string,
  branch: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const [owner, repoName] = repo.split("/")
    if (!owner || !repoName) {
      throw new Error("Invalid repository format")
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${SETTINGS_FILE_PATH}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )

    if (response.status === 404) {
      // File doesn't exist yet
      return null
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`)
    }

    const data = await response.json()
    const decodedContent = decodeURIComponent(
      escape(atob(data.content.replace(/\n/g, "")))
    )

    return {
      content: decodedContent,
      sha: data.sha,
    }
  } catch (error) {
    console.error("Download settings error:", error)
    throw error
  }
}
