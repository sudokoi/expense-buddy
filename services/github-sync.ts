/**
 * GitHub API client for syncing expense data
 */

interface GitHubFileResponse {
  content: string;
  sha: string;
}

interface GitHubCommitRequest {
  message: string;
  content: string;
  sha?: string;
}

/**
 * Validate GitHub Personal Access Token and repository access
 */
export async function validatePAT(
  token: string,
  repo: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      return {
        valid: false,
        error: "Invalid repository format. Use: username/repo",
      };
    }

    console.log(
      "Testing connection to:",
      `https://api.github.com/repos/${owner}/${repoName}`
    );

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    console.log("GitHub API Response status:", response.status);

    if (response.status === 404) {
      return {
        valid: false,
        error:
          "Repository not found or token lacks access. Check: 1) Repo name is correct 2) Token has Contents permission 3) Token can access this specific repo",
      };
    }

    if (response.status === 401) {
      return {
        valid: false,
        error: "Invalid or expired Personal Access Token",
      };
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      console.log("403 Error details:", errorData);
      return {
        valid: false,
        error:
          "Access forbidden. Token may lack required permissions (Contents: Read and Write)",
      };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("API Error:", errorData);
      return {
        valid: false,
        error: `GitHub API error (${response.status}): ${
          errorData.message || response.statusText
        }`,
      };
    }

    const repoData = await response.json();
    console.log("Repository found:", repoData.full_name);
    return { valid: true };
  } catch (error) {
    console.error("Connection test error:", error);
    return { valid: false, error: `Network error: ${error}` };
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
    const [owner, repoName] = repo.split("/");
    const encodedContent = btoa(unescape(encodeURIComponent(csvContent)));

    // First, try to get existing file SHA
    let existingSHA: string | undefined;
    try {
      const fileData = await downloadCSV(token, repo, branch, filePath);
      if (fileData) {
        existingSHA = fileData.sha;
      }
    } catch (e) {
      // File doesn't exist, that's okay
    }

    const requestBody: GitHubCommitRequest = {
      message: `Update expenses - ${new Date().toISOString()}`,
      content: encodedContent,
    };

    if (existingSHA) {
      requestBody.sha = existingSHA;
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
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || response.statusText,
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `Upload failed: ${error}` };
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
    const [owner, repoName] = repo.split("/");

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (response.status === 404) {
      // File doesn't exist yet
      return null;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data: GitHubFileResponse = await response.json();
    const decodedContent = decodeURIComponent(
      escape(atob(data.content.replace(/\n/g, "")))
    );

    return {
      content: decodedContent,
      sha: data.sha,
    };
  } catch (error) {
    console.error("Download CSV error:", error);
    throw error;
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
    const [owner, repoName] = repo.split("/");

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (response.status === 404) {
      // Directory doesn't exist yet
      return [];
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter for files only (not directories)
    if (Array.isArray(data)) {
      return data
        .filter((item: any) => item.type === "file")
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
        }));
    }

    return [];
  } catch (error) {
    console.error("List files error:", error);
    return [];
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
    const [owner, repoName] = repo.split("/");

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
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || response.statusText,
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `Delete failed: ${error}` };
  }
}
