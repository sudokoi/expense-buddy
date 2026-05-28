import { secureStorage } from "./secure-storage"
import { getLatestCommitTimestamp, GitHubApiError } from "./github-sync"
import { groupExpensesByDay, getFilenameForDay } from "./daily-file-manager"
import { computeContentHash, loadFileHashes } from "./hash-storage"
import { loadDirtyDays } from "./expense-dirty-days"
import { exportToCSV } from "./csv-handler"
import { getUserFriendlyMessage } from "./error-utils"
import { loadSyncConfig } from "./sync-config"
import i18next from "i18next"
import type { Expense } from "../types/expense"
import type { SyncDirectionResult } from "../types/sync"

const LAST_SYNC_TIME_KEY = "last_sync_time"

async function getLastSyncTime(): Promise<string | null> {
  return await secureStorage.getItem(LAST_SYNC_TIME_KEY)
}

export async function saveLastSyncTime(timestamp: string): Promise<void> {
  await secureStorage.setItem(LAST_SYNC_TIME_KEY, timestamp)
}

export async function determineSyncDirection(
  hasLocalChanges: boolean
): Promise<SyncDirectionResult> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      console.warn("[SyncManager] determineSyncDirection failed: No sync configuration")
      return {
        direction: "error",
        localTime: null,
        remoteTime: null,
        error: i18next.t("githubSync.manager.noConfigFound"),
      }
    }

    const localLastSync = await getLastSyncTime()

    const remoteResult = await getLatestCommitTimestamp(
      config.token,
      config.repo,
      config.branch
    )

    if ("error" in remoteResult) {
      console.warn("[SyncManager] determineSyncDirection failed:", remoteResult.error)
      return {
        direction: "error",
        localTime: localLastSync,
        remoteTime: null,
        error: getUserFriendlyMessage(new Error(remoteResult.error)),
      }
    }

    const remoteTime = remoteResult.timestamp

    if (!localLastSync) {
      if (hasLocalChanges && new Date(remoteTime).getTime() > 0) {
        return {
          direction: "conflict",
          localTime: null,
          remoteTime: remoteTime,
        }
      }
      if (hasLocalChanges) {
        return { direction: "push", localTime: null, remoteTime: remoteTime }
      }
      return { direction: "pull", localTime: null, remoteTime: remoteTime }
    }

    const localSyncMs = new Date(localLastSync).getTime()
    const remoteMs = new Date(remoteTime).getTime()

    const remoteIsNewer = remoteMs > localSyncMs
    const localHasChanges = hasLocalChanges

    if (remoteIsNewer && localHasChanges) {
      return {
        direction: "conflict",
        localTime: localLastSync,
        remoteTime: remoteTime,
      }
    }

    if (remoteIsNewer) {
      return {
        direction: "pull",
        localTime: localLastSync,
        remoteTime: remoteTime,
      }
    }

    if (localHasChanges) {
      return {
        direction: "push",
        localTime: localLastSync,
        remoteTime: remoteTime,
      }
    }

    return {
      direction: "in_sync",
      localTime: localLastSync,
      remoteTime: remoteTime,
    }
  } catch (error) {
    console.warn("[SyncManager] determineSyncDirection failed:", error)
    return {
      direction: "error",
      localTime: null,
      remoteTime: null,
      error: getUserFriendlyMessage(error),
    }
  }
}

export async function getPendingSyncCount(expenses: Expense[]): Promise<{
  filesChanged: number
  filesUnchanged: number
  filesToDelete: number
}> {
  try {
    const storedHashes = await loadFileHashes()
    const groupedByDay = groupExpensesByDay(expenses)
    const dirtyDaysResult = await loadDirtyDays()
    const useDirtyDays = dirtyDaysResult.isTrusted
    const dirtyDaySet = new Set(dirtyDaysResult.state.dirtyDays)
    const deletedDaySet = new Set(dirtyDaysResult.state.deletedDays)
    const localDayKeys = new Set(groupedByDay.keys())
    const dayKeysToProcess = useDirtyDays
      ? new Set([...dirtyDaySet].filter((dayKey) => localDayKeys.has(dayKey)))
      : localDayKeys

    let filesChanged = 0
    let filesUnchanged = 0

    for (const dayKey of dayKeysToProcess) {
      const dayExpenses = groupedByDay.get(dayKey)
      if (!dayExpenses) continue
      const filename = getFilenameForDay(dayKey)
      const csvContent = exportToCSV(dayExpenses)
      const contentHash = computeContentHash(csvContent)

      if (storedHashes[filename] === contentHash) {
        filesUnchanged++
      } else {
        filesChanged++
      }
    }

    let filesToDelete = 0
    if (useDirtyDays) {
      for (const dayKey of deletedDaySet) {
        const filename = getFilenameForDay(dayKey)
        if (storedHashes[filename] && !localDayKeys.has(dayKey)) {
          filesToDelete++
        }
      }
    } else {
      const localFilenames = new Set(
        Array.from(groupedByDay.keys()).map(getFilenameForDay)
      )
      filesToDelete = Object.keys(storedHashes).filter(
        (filename) => !localFilenames.has(filename)
      ).length
    }

    return { filesChanged, filesUnchanged, filesToDelete }
  } catch (error) {
    console.warn("Failed to compute pending sync count:", error)
    const groupedByDay = groupExpensesByDay(expenses)
    return {
      filesChanged: groupedByDay.size,
      filesUnchanged: 0,
      filesToDelete: 0,
    }
  }
}
