import { secureStorage } from "./secure-storage"
import type { Expense } from "../types/expense"

const LAST_SYNC_TIME_KEY = "last_sync_time"

async function getLastSyncTime(): Promise<string | null> {
  return await secureStorage.getItem(LAST_SYNC_TIME_KEY)
}

export function mergeExpensesWithTimestamps(
  local: Expense[],
  remote: Expense[],
  lastSyncTime: string | null
): { merged: Expense[]; newFromRemote: number; updatedFromRemote: number } {
  const localMap = new Map(local.map((e) => [e.id, e]))
  const remoteMap = new Map(remote.map((e) => [e.id, e]))
  const merged: Expense[] = []
  let newFromRemote = 0
  let updatedFromRemote = 0

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localItem = localMap.get(id)
    const remoteItem = remoteMap.get(id)

    if (localItem && remoteItem) {
      const localTime = new Date(localItem.updatedAt).getTime()
      const remoteTime = new Date(remoteItem.updatedAt).getTime()
      if (remoteTime > localTime) {
        merged.push(remoteItem)
        updatedFromRemote++
      } else {
        merged.push(localItem)
      }
    } else if (localItem) {
      merged.push(localItem)
    } else if (remoteItem) {
      if (lastSyncTime) {
        const lastSync = new Date(lastSyncTime).getTime()
        const itemUpdated = new Date(remoteItem.updatedAt).getTime()

        if (lastSync > itemUpdated) {
          continue
        }
      }
      merged.push(remoteItem)
      newFromRemote++
    }
  }

  const sortedMerged = merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return {
    merged: sortedMerged,
    newFromRemote,
    updatedFromRemote,
  }
}

export async function smartMerge(
  localExpenses: Expense[],
  remoteExpenses: Expense[]
): Promise<{
  merged: Expense[]
  newFromRemote: number
  updatedFromRemote: number
}> {
  const lastSyncTime = await getLastSyncTime()
  return mergeExpensesWithTimestamps(localExpenses, remoteExpenses, lastSyncTime)
}
