import { secureStorage } from "./secure-storage"
import { validatePAT, GitHubApiError } from "./github-sync"
import { getUserFriendlyMessage } from "./error-utils"
import i18next from "i18next"
import type { SyncConfig, SyncResult } from "../types/sync"

const GITHUB_TOKEN_KEY = "github_pat"
const GITHUB_REPO_KEY = "github_repo"
const GITHUB_BRANCH_KEY = "github_branch"

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await secureStorage.setItem(GITHUB_TOKEN_KEY, config.token.trim())
  await secureStorage.setItem(GITHUB_REPO_KEY, config.repo.trim())
  await secureStorage.setItem(GITHUB_BRANCH_KEY, config.branch.trim())
}

export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const token = await secureStorage.getItem(GITHUB_TOKEN_KEY)
  const repo = await secureStorage.getItem(GITHUB_REPO_KEY)
  const branch = await secureStorage.getItem(GITHUB_BRANCH_KEY)

  if (!token || !repo || !branch) {
    return null
  }

  return { token, repo, branch }
}

export async function clearSyncConfig(): Promise<void> {
  await secureStorage.deleteItem(GITHUB_TOKEN_KEY)
  await secureStorage.deleteItem(GITHUB_REPO_KEY)
  await secureStorage.deleteItem(GITHUB_BRANCH_KEY)
}

export async function testConnection(): Promise<SyncResult> {
  const config = await loadSyncConfig()
  if (!config) {
    console.warn("[SyncManager] testConnection failed: No sync configuration found")
    return {
      success: false,
      message: i18next.t("githubSync.manager.noConfigFound"),
      error: i18next.t("githubSync.manager.notConfigured"),
    }
  }

  try {
    const result = await validatePAT(config.token, config.repo)
    if (result.valid) {
      return { success: true, message: i18next.t("githubSync.manager.connectionSuccess") }
    } else {
      console.warn("[SyncManager] testConnection failed:", result.error)

      if (result.shouldSignOut && result.authStatus) {
        return {
          success: false,
          message: "Connection failed",
          error: result.error || "GitHub authentication required",
          authStatus: result.authStatus,
          shouldSignOut: true,
        }
      }

      return {
        success: false,
        message: "Connection failed",
        error: getUserFriendlyMessage(new Error(result.error || "Unknown error")),
      }
    }
  } catch (error) {
    console.warn("[SyncManager] testConnection failed:", error)

    if (
      error instanceof GitHubApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return {
        success: false,
        message: "Connection failed",
        error: error.message,
        authStatus: error.status,
        shouldSignOut: error.shouldSignOut,
      }
    }

    return {
      success: false,
      message: i18next.t("githubSync.manager.connectionFailed"),
      error: getUserFriendlyMessage(error),
    }
  }
}
