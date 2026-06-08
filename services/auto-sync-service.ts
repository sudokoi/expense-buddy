import { Expense } from "../types/expense"
import { AppSettings, loadSettings } from "./settings-manager"
import type { SyncNotification } from "../types/sync"
import { syncOrchestrator } from "./sync/sync-engine"

// Register provider factories at import time
import "./sync"

/**
 * Background auto-sync entry point.
 *
 * This module no longer owns the sync flow: the {@link syncOrchestrator} owns
 * the machine actor, the queue/watermark logic, first-sync gating, and the
 * activation-triggered first reconciliation. This function now simply delegates
 * to the orchestrator and adapts its run result to the legacy return shape for
 * any remaining callers. It does NOT drive first reconciliation
 * (`markReconciledInStore` / `markProviderReconciled`) — the orchestrator marks
 * a provider reconciled itself on a successful activation-triggered run.
 *
 * The `localExpenses` argument is retained for signature compatibility but is
 * ignored: the orchestrator snapshots the in-memory expense set through its
 * injected `getLocalExpenses` binding.
 */
export async function performAutoSyncIfEnabled(_localExpenses: Expense[]): Promise<{
  synced: boolean
  expenses?: Expense[]
  notification?: SyncNotification
  downloadedSettings?: AppSettings
  error?: string
  errorCode?: string
  pendingExpenseOps?: boolean
}> {
  const result = await syncOrchestrator.manualSync()

  if (result.skipped || result.awaitingInitialReconciliation) {
    return { synced: false }
  }

  if (!result.success) {
    return {
      synced: false,
      error: result.error,
      errorCode: result.errorCode,
    }
  }

  return {
    synced: true,
    expenses: result.expenses,
    notification: result.notification,
    downloadedSettings: result.downloadedSettings,
    pendingExpenseOps: result.pendingExpenseOps,
  }
}

export async function shouldAutoSyncForTiming(
  timing: "on_launch" | "on_change"
): Promise<boolean> {
  const settings = await loadSettings()
  return settings.autoSyncEnabled && settings.autoSyncTiming === timing
}
