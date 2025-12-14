import { APP_CONFIG } from "../constants/app-config";

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseNotes?: string;
  error?: string;
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, "").split(".").map(Number);
  const parts2 = v2.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * Check for app updates from GitHub releases
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = APP_CONFIG.version;

  try {
    const { owner, repo } = APP_CONFIG.github;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          hasUpdate: false,
          currentVersion,
          error: "No releases found",
        };
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, "");
    const releaseUrl = release.html_url;
    const releaseNotes = release.body || "";

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl,
      releaseNotes,
    };
  } catch (error) {
    console.error("Update check failed:", error);
    return {
      hasUpdate: false,
      currentVersion,
      error:
        error instanceof Error ? error.message : "Failed to check for updates",
    };
  }
}
