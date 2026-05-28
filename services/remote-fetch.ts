import { loadSyncConfig } from "./sync-config"
import { getRepositoryTree, listFiles, downloadCSV, GitHubApiError } from "./github-sync"
import { loadRemoteSHACache } from "./remote-sha-cache"
import { groupExpensesByDay, getDayKeyFromFilename } from "./daily-file-manager"
import { importFromCSV } from "./csv-handler"
import { getUserFriendlyMessage } from "./error-utils"
import { pMap } from "./retry"
import type { Expense } from "../types/expense"
import type { SyncConfig, FetchAllRemoteResult } from "../types/sync"
import i18next from "i18next"

export function classifyTreeEntries(
  expenseEntries: { path: string; sha: string }[],
  shaCache: { [filename: string]: string },
  localDayKeys: Set<string>
): {
  changed: { path: string; sha: string }[]
  unchanged: { path: string; sha: string; dayKey: string }[]
} {
  const changed: { path: string; sha: string }[] = []
  const unchanged: { path: string; sha: string; dayKey: string }[] = []

  for (const entry of expenseEntries) {
    const dayKey = getDayKeyFromFilename(entry.path)!
    if (shaCache[entry.path] === entry.sha && localDayKeys.has(dayKey)) {
      unchanged.push({ ...entry, dayKey })
    } else {
      changed.push(entry)
    }
  }

  return { changed, unchanged }
}

async function fetchWithTree(
  config: SyncConfig,
  entries: { path: string; sha: string }[],
  localExpenses?: Expense[]
): Promise<FetchAllRemoteResult> {
  const expenseEntries = entries.filter(
    (entry) => getDayKeyFromFilename(entry.path) !== null
  )

  if (expenseEntries.length === 0) {
    return {
      success: true,
      expenses: [],
      filesDownloaded: 0,
      treeEntries: entries.map((e) => ({ path: e.path, sha: e.sha })),
    }
  }

  const shaCache = await loadRemoteSHACache()

  const localByDay = localExpenses
    ? groupExpensesByDay(localExpenses)
    : new Map<string, Expense[]>()

  const { changed: changedFiles, unchanged: unchangedFiles } = classifyTreeEntries(
    expenseEntries,
    shaCache,
    new Set(localByDay.keys())
  )

  const allExpenses: Expense[] = []
  let downloadedFiles = 0
  const downloadErrors: string[] = []

  for (const file of unchangedFiles) {
    const dayExpenses = localByDay.get(file.dayKey)
    if (dayExpenses) {
      allExpenses.push(...dayExpenses)
    }
  }

  const downloadResults = await pMap(
    changedFiles,
    async (file) => {
      try {
        const fileData = await downloadCSV(
          config.token,
          config.repo,
          config.branch,
          file.path
        )
        if (fileData) {
          const expenses = importFromCSV(fileData.content)
          return { expenses, ok: true as const }
        }
        return { expenses: [] as Expense[], ok: true as const }
      } catch (fileError) {
        if (
          fileError instanceof GitHubApiError &&
          (fileError.status === 401 || fileError.status === 403)
        ) {
          return { error: fileError, fatal: true as const }
        }
        console.warn(`Failed to download ${file.path}:`, fileError)
        return { error: fileError, fatal: false as const }
      }
    },
    5
  )

  const fatalError = downloadResults.find((r) => "fatal" in r && r.fatal)
  if (fatalError && "error" in fatalError) {
    const err = fatalError.error as GitHubApiError
    return {
      success: false,
      error: err.message,
      authStatus: err.status as 401 | 403,
      shouldSignOut: err.shouldSignOut,
    }
  }

  for (const r of downloadResults) {
    if ("ok" in r && r.ok) {
      allExpenses.push(...r.expenses)
      downloadedFiles++
    } else {
      downloadErrors.push("path" in (r as any) ? (r as any).path : "unknown")
    }
  }

  if (downloadedFiles === 0 && changedFiles.length > 0) {
    return {
      success: false,
      error: i18next.t("githubSync.manager.downloadFailedWithCount", {
        count: downloadErrors.length,
      }),
    }
  }

  return {
    success: true,
    expenses: allExpenses,
    filesDownloaded: downloadedFiles,
    treeEntries: entries.map((e) => ({ path: e.path, sha: e.sha })),
  }
}

async function fetchWithContentsApi(config: SyncConfig): Promise<FetchAllRemoteResult> {
  let files: { name: string; path: string; sha: string }[]
  try {
    files = await listFiles(config.token, config.repo, config.branch)
  } catch (listError) {
    if (
      listError instanceof GitHubApiError &&
      (listError.status === 401 || listError.status === 403)
    ) {
      return {
        success: false,
        error: listError.message,
        authStatus: listError.status,
        shouldSignOut: listError.shouldSignOut,
      }
    }

    const errorMessage = String(listError)
    if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("Network request failed") ||
      errorMessage.includes("TypeError")
    ) {
      return {
        success: false,
        error: i18next.t("githubSync.errors.noInternet"),
      }
    }
    return {
      success: false,
      error: i18next.t("githubSync.manager.failedToListRemoteWithError", {
        error: errorMessage,
      }),
    }
  }

  const expenseFiles = files.filter((file) => getDayKeyFromFilename(file.name) !== null)

  if (expenseFiles.length === 0) {
    return {
      success: true,
      expenses: [],
      filesDownloaded: 0,
    }
  }

  const downloadResults = await pMap(
    expenseFiles,
    async (file) => {
      try {
        const fileData = await downloadCSV(
          config.token,
          config.repo,
          config.branch,
          file.path
        )
        if (fileData) {
          const expenses = importFromCSV(fileData.content)
          return { expenses, ok: true as const }
        }
        return { expenses: [] as Expense[], ok: true as const }
      } catch (fileError) {
        if (
          fileError instanceof GitHubApiError &&
          (fileError.status === 401 || fileError.status === 403)
        ) {
          return { error: fileError, fatal: true as const }
        }
        console.warn(`Failed to download ${file.path}:`, fileError)
        return { error: fileError, fatal: false as const }
      }
    },
    5
  )

  const fatalError = downloadResults.find((r) => "fatal" in r && r.fatal)
  if (fatalError && "error" in fatalError) {
    const err = fatalError.error as GitHubApiError
    return {
      success: false,
      error: err.message,
      authStatus: err.status as 401 | 403,
      shouldSignOut: err.shouldSignOut,
    }
  }

  const allExpenses: Expense[] = []
  let downloadedFiles = 0

  for (const r of downloadResults) {
    if ("ok" in r && r.ok) {
      allExpenses.push(...r.expenses)
      downloadedFiles++
    }
  }

  if (downloadedFiles === 0 && expenseFiles.length > 0) {
    const errorCount = downloadResults.filter((r) => !("ok" in r)).length
    return {
      success: false,
      error: i18next.t("githubSync.manager.downloadFailedWithCount", {
        count: errorCount,
      }),
    }
  }

  return {
    success: true,
    expenses: allExpenses,
    filesDownloaded: downloadedFiles,
  }
}

export async function fetchAllRemoteExpenses(
  localExpenses?: Expense[]
): Promise<FetchAllRemoteResult> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        error: i18next.t("githubSync.manager.noConfigFound"),
      }
    }

    const treeResult = await getRepositoryTree(config.token, config.repo, config.branch)

    if (!treeResult.success && treeResult.authStatus) {
      return {
        success: false,
        error: treeResult.error,
        authStatus: treeResult.authStatus,
        shouldSignOut: treeResult.shouldSignOut,
      }
    }

    if (treeResult.success) {
      return await fetchWithTree(config, treeResult.entries, localExpenses)
    }

    return await fetchWithContentsApi(config)
  } catch (error) {
    console.warn("[SyncManager] fetchAllRemoteExpenses failed:", error)
    return {
      success: false,
      error: getUserFriendlyMessage(error),
    }
  }
}
