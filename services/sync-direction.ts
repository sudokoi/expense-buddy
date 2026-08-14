import { secureStorage } from "./secure-storage"

const LAST_SYNC_TIME_KEY = "last_sync_time"

export async function saveLastSyncTime(timestamp: string): Promise<void> {
  await secureStorage.setItem(LAST_SYNC_TIME_KEY, timestamp)
}
