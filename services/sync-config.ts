import AsyncStorage from "@react-native-async-storage/async-storage"
import { secureStorage } from "./secure-storage"
import { validatePAT, GitHubApiError } from "./github-sync"
import { getUserFriendlyMessage } from "./error-utils"
import { providerSettingsStore } from "./sync/provider-settings-store"
import { credentialStore } from "./sync/credential-store"
import type { ProviderConfig, GitHubProviderConfig } from "./sync/provider-types"
import i18next from "i18next"
import type { SyncConfig, SyncResult } from "../types/sync"

const GITHUB_TOKEN_KEY = "github_pat"
const GITHUB_REPO_KEY = "github_repo"
const GITHUB_BRANCH_KEY = "github_branch"

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await secureStorage.setItem(GITHUB_TOKEN_KEY, config.token.trim())
  await secureStorage.setItem(GITHUB_REPO_KEY, config.repo.trim())
  await secureStorage.setItem(GITHUB_BRANCH_KEY, config.branch.trim())

  await credentialStore.save("github_pat", {
    credentialId: "github_pat",
    kind: "github_pat",
    data: { token: config.token.trim() },
  })

  const providerConfig: GitHubProviderConfig = {
    kind: "github",
    id: "default",
    label: config.repo.trim(),
    credentialId: "github_pat",
    repo: config.repo.trim(),
    branch: config.branch.trim(),
  }
  await providerSettingsStore.addProvider(providerConfig)
  await providerSettingsStore.setActiveProvider("default")
}

export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const token = await secureStorage.getItem(GITHUB_TOKEN_KEY)
  const repo = await secureStorage.getItem(GITHUB_REPO_KEY)
  const branch = await secureStorage.getItem(GITHUB_BRANCH_KEY)

  if (!token || !repo || !branch) {
    const active = await providerSettingsStore.getActiveConfig()
    if (!active || active.kind !== "github") return null
    const entry = await credentialStore.get(active.credentialId)
    if (!entry) return null
    return {
      token: entry.data["token"] ?? "",
      repo: active.repo,
      branch: active.branch,
    }
  }

  return { token, repo, branch }
}

export async function clearSyncConfig(): Promise<void> {
  await secureStorage.deleteItem(GITHUB_TOKEN_KEY)
  await secureStorage.deleteItem(GITHUB_REPO_KEY)
  await secureStorage.deleteItem(GITHUB_BRANCH_KEY)
  await credentialStore.delete("github_pat")

  const state = await providerSettingsStore.load()
  const githubProviders = state.providers.filter((p) => p.kind === "github")
  for (const provider of githubProviders) {
    await providerSettingsStore.removeProvider(provider.id)
  }
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
          message: i18next.t("githubSync.manager.connectionFailed"),
          error: result.error || i18next.t("githubSync.manager.authRequired"),
          authStatus: result.authStatus,
          shouldSignOut: true,
        }
      }

      return {
        success: false,
        message: i18next.t("githubSync.manager.connectionFailed"),
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
        message: i18next.t("githubSync.manager.connectionFailed"),
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

export async function getActiveProviderConfig(): Promise<ProviderConfig | null> {
  return providerSettingsStore.getActiveConfig()
}

const MIGRATION_KEY = "sync.migration.v1"

/**
 * Migrates old single-GitHub config to the multi-provider format.
 *
 * Checks if old SecureStorage keys exist but no provider store data,
 * then creates a GitHub provider entry from the old config.
 *
 * Idempotent: writes a migration marker key on success.
 * Safe to re-run: skips if migration marker exists or providers already exist.
 */
export async function migrateSyncConfig(): Promise<void> {
  try {
    const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY)
    if (alreadyMigrated) return

    const providerState = await providerSettingsStore.load()
    if (providerState.providers.length > 0) return

    const token = await secureStorage.getItem(GITHUB_TOKEN_KEY)
    const repo = await secureStorage.getItem(GITHUB_REPO_KEY)
    const branch = await secureStorage.getItem(GITHUB_BRANCH_KEY)

    if (!token || !repo || !branch) return

    await credentialStore.save("github_pat", {
      credentialId: "github_pat",
      kind: "github_pat",
      data: { token: token.trim() },
    })

    const providerConfig: GitHubProviderConfig = {
      kind: "github",
      id: "default",
      label: repo.trim(),
      credentialId: "github_pat",
      repo: repo.trim(),
      branch: branch.trim(),
    }
    await providerSettingsStore.addProvider(providerConfig)
    await providerSettingsStore.setActiveProvider("default")
    await AsyncStorage.setItem(MIGRATION_KEY, "true")
  } catch (error) {
    console.warn("Sync config migration failed (will retry):", error)
  }
}
