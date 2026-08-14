export type {
  SyncConfig,
  SyncResult,
  SyncNotification,
  FetchAllRemoteResult,
} from "../types/sync"

export {
  saveSyncConfig,
  loadSyncConfig,
  clearSyncConfig,
  testConnection,
} from "./sync-config"
export { saveLastSyncTime } from "./sync-direction"
export { syncDown, syncDownMore } from "./sync-download"
export { fetchAllRemoteExpenses, classifyTreeEntries } from "./remote-fetch"

export {
  gitStyleSync,
  ConflictResolution,
  GitStyleSyncResult,
  OnConflictCallback,
} from "./git-style-sync"
