import { Expense } from "../types/expense"
import { Category } from "../types/category"
import { AppSettings } from "./settings-manager"
import {
  SyncQueueOp,
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
} from "./sync-queue"

export interface ReconcileAfterSyncInput {
  /** Local expenses after the merge, before queued ops are replayed. */
  baseExpenses: Expense[]
  /** Settings to build from (local settings, or the merge result). */
  settings: AppSettings
  /** Fully merged settings from the sync result, when settings synced. */
  mergedSettings?: AppSettings
  /** Merged categories only, when settings did not fully sync. */
  mergedCategories?: Category[]
  /** Ops captured after the sync watermark, to replay on top of the merge. */
  opsAfter: SyncQueueOp[]
}

export interface ReconcileAfterSyncResult {
  expenses: Expense[]
  settings: AppSettings
  hasPendingExpenseOps: boolean
  hasPendingSettingsOps: boolean
}

/**
 * Reconcile the merge result with any ops queued while the sync was running.
 *
 * The expense and settings bases are resolved from the merge result, queued ops
 * are replayed on top, and the pending-op flags tell the caller whether dirty
 * state can be cleared or must survive until the next sync.
 */
export function reconcileAfterSync(
  input: ReconcileAfterSyncInput
): ReconcileAfterSyncResult {
  const { opsAfter } = input

  const expenses = applyQueuedOpsToExpenses(input.baseExpenses, opsAfter)
  const hasPendingExpenseOps = opsAfter.some((op) => op.type.startsWith("expense."))
  const hasPendingSettingsOps = opsAfter.some(
    (op) => op.type.startsWith("settings.") || op.type.startsWith("category.")
  )
  let settingsBase = input.settings
  if (input.mergedSettings) {
    settingsBase = input.mergedSettings
  } else if (input.mergedCategories) {
    settingsBase = { ...settingsBase, categories: input.mergedCategories }
  }

  const settings = applyQueuedOpsToSettings(settingsBase, opsAfter)

  return {
    expenses,
    settings,
    hasPendingExpenseOps,
    hasPendingSettingsOps,
  }
}
