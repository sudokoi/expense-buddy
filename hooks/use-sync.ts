/**
 * TanStack Query hooks for GitHub sync operations
 */
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Expense } from "../types/expense"
import { AppSettings } from "../services/settings-manager"
import {
  syncUp,
  syncDown,
  determineSyncDirection,
  analyzeConflicts,
  SyncResult,
} from "../services/sync-manager"

export type SyncStatus = "idle" | "syncing" | "success" | "error"

export interface SyncPushParams {
  expenses: Expense[]
  settings?: AppSettings
  syncSettingsEnabled?: boolean
}

export interface SyncPullParams {
  daysToDownload?: number
  syncSettingsEnabled?: boolean
}

export interface SyncPullResult {
  success: boolean
  message: string
  expenses?: Expense[]
  settings?: AppSettings
  error?: string
  hasMore?: boolean
  settingsDownloaded?: boolean
}

export interface SmartSyncParams {
  expenses: Expense[]
  settings?: AppSettings
  syncSettingsEnabled?: boolean
  hasLocalChanges: boolean
  // Callbacks for handling conflicts and results
  onMergeRequired?: (
    remoteExpenses: Expense[],
    summary: string,
    downloadedSettings?: AppSettings
  ) => Promise<void>
  onSettingsDownloaded?: (settings: AppSettings) => void
}

export const syncKeys = {
  all: ["sync"] as const,
  push: () => [...syncKeys.all, "push"] as const,
  pull: () => [...syncKeys.all, "pull"] as const,
  direction: () => [...syncKeys.all, "direction"] as const,
}

export function useSyncPush() {
  return useMutation({
    mutationKey: syncKeys.push(),
    mutationFn: async ({
      expenses,
      settings,
      syncSettingsEnabled,
    }: SyncPushParams): Promise<SyncResult> => {
      return syncUp(expenses, settings, syncSettingsEnabled)
    },
  })
}

export function useSyncPull() {
  return useMutation({
    mutationKey: syncKeys.pull(),
    mutationFn: async ({
      daysToDownload = 7,
      syncSettingsEnabled,
    }: SyncPullParams): Promise<SyncPullResult> => {
      return syncDown(daysToDownload, syncSettingsEnabled)
    },
  })
}

export function useSmartSync() {
  const queryClient = useQueryClient()
  const pushMutation = useSyncPush()
  const pullMutation = useSyncPull()

  const smartSyncMutation = useMutation({
    mutationKey: [...syncKeys.all, "smart"],
    mutationFn: async (params: SmartSyncParams) => {
      const { expenses, settings, syncSettingsEnabled, hasLocalChanges } = params

      const directionResult = await determineSyncDirection(hasLocalChanges)

      if (directionResult.direction === "error") {
        throw new Error(directionResult.error || "Failed to check sync status")
      }

      switch (directionResult.direction) {
        case "in_sync":
          return {
            action: "in_sync" as const,
            message: "Already in sync - no changes needed",
          }

        case "push": {
          const result = await syncUp(expenses, settings, syncSettingsEnabled)
          if (!result.success) {
            throw new Error(result.error || result.message)
          }
          return {
            action: "push" as const,
            message: result.message,
            result,
          }
        }

        case "pull": {
          const downloadResult = await syncDown(7, syncSettingsEnabled)
          if (!downloadResult.success) {
            throw new Error(downloadResult.error || "Failed to download")
          }

          // Analyze conflicts for the merge
          const analysis = await analyzeConflicts(expenses)
          if (!analysis.success) {
            throw new Error(analysis.error || "Failed to analyze conflicts")
          }

          return {
            action: "pull" as const,
            message: downloadResult.message,
            downloadResult,
            analysis,
          }
        }

        case "conflict":
          return {
            action: "conflict" as const,
            message: "Both local and remote have changes",
            localTime: directionResult.localTime,
            remoteTime: directionResult.remoteTime,
          }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncKeys.all })
    },
  })

  return {
    ...smartSyncMutation,
    isPushPending: pushMutation.isPending,
    isPullPending: pullMutation.isPending,
  }
}

export function useSyncStatus() {
  const queryClient = useQueryClient()
  const mutationCache = queryClient.getMutationCache()

  const isSyncing = mutationCache
    .getAll()
    .some(
      (mutation) =>
        mutation.state.status === "pending" &&
        Array.isArray(mutation.options.mutationKey) &&
        mutation.options.mutationKey[0] === "sync"
    )

  const latestSyncMutation = mutationCache
    .getAll()
    .filter(
      (mutation) =>
        Array.isArray(mutation.options.mutationKey) &&
        mutation.options.mutationKey[0] === "sync"
    )
    .sort((a, b) => (b.state.submittedAt || 0) - (a.state.submittedAt || 0))[0]

  const isSuccess = latestSyncMutation?.state.status === "success"
  const isError = latestSyncMutation?.state.status === "error"

  const syncStatus: SyncStatus = isSyncing
    ? "syncing"
    : isSuccess
      ? "success"
      : isError
        ? "error"
        : "idle"

  return {
    syncStatus,
    isSyncing,
    isSuccess,
    isError,
  }
}
