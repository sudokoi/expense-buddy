/**
 * TanStack Query hooks for GitHub sync operations
 *
 * Replaces xstate sync-status-store with proper mutation-based state management
 */

import { useState, useEffect, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Alert } from "react-native"
import { Expense } from "../types/expense"
import { AppSettings } from "../services/settings-manager"
import {
  syncUp,
  syncDown,
  determineSyncDirection,
  analyzeConflicts,
  smartMerge,
  SyncResult,
  SyncNotification,
} from "../services/sync-manager"

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Mutation Keys
// ============================================================================

export const syncKeys = {
  all: ["sync"] as const,
  push: () => [...syncKeys.all, "push"] as const,
  pull: () => [...syncKeys.all, "pull"] as const,
  direction: () => [...syncKeys.all, "direction"] as const,
}

// ============================================================================
// useSyncPush - Mutation for uploading to GitHub
// ============================================================================

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

// ============================================================================
// useSyncPull - Mutation for downloading from GitHub
// ============================================================================

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

// ============================================================================
// useSmartSync - Unified sync that determines direction and acts accordingly
// ============================================================================

export function useSmartSync() {
  const queryClient = useQueryClient()
  const pushMutation = useSyncPush()
  const pullMutation = useSyncPull()

  const smartSyncMutation = useMutation({
    mutationKey: [...syncKeys.all, "smart"],
    mutationFn: async (params: SmartSyncParams) => {
      const { expenses, settings, syncSettingsEnabled, hasLocalChanges } = params

      // Step 1: Determine sync direction
      const directionResult = await determineSyncDirection(hasLocalChanges)

      if (directionResult.direction === "error") {
        throw new Error(directionResult.error || "Failed to check sync status")
      }

      // Step 2: Execute based on direction
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
          // Return conflict info - caller will handle the UI prompt
          return {
            action: "conflict" as const,
            message: "Both local and remote have changes",
            localTime: directionResult.localTime,
            remoteTime: directionResult.remoteTime,
          }
      }
    },
    onSuccess: () => {
      // Invalidate any sync-related queries
      queryClient.invalidateQueries({ queryKey: syncKeys.all })
    },
  })

  return {
    ...smartSyncMutation,
    // Expose individual mutation states for combined status
    isPushPending: pushMutation.isPending,
    isPullPending: pullMutation.isPending,
  }
}

// ============================================================================
// useSyncStatus - Derived sync status from mutation states
// Replaces xstate sync-status-store with proper TanStack Query state
// ============================================================================

export function useSyncStatus() {
  const [displayStatus, setDisplayStatus] = useState<SyncStatus>("idle")
  const queryClient = useQueryClient()

  // Get all sync mutation states
  const mutationCache = queryClient.getMutationCache()

  // Check if any sync mutation is pending
  const isSyncing = mutationCache
    .getAll()
    .some(
      (mutation) =>
        mutation.state.status === "pending" &&
        Array.isArray(mutation.options.mutationKey) &&
        mutation.options.mutationKey[0] === "sync"
    )

  // Check latest mutation result
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

  // Compute current status
  useEffect(() => {
    if (isSyncing) {
      setDisplayStatus("syncing")
    } else if (isSuccess) {
      setDisplayStatus("success")
      // Auto-reset success status after 2 seconds (matching xstate behavior)
      const timer = setTimeout(() => {
        setDisplayStatus("idle")
      }, 2000)
      return () => clearTimeout(timer)
    } else if (isError) {
      setDisplayStatus("error")
    } else {
      setDisplayStatus("idle")
    }
  }, [isSyncing, isSuccess, isError])

  return {
    syncStatus: displayStatus,
    isSyncing: displayStatus === "syncing",
    isSuccess: displayStatus === "success",
    isError: displayStatus === "error",
  }
}

// ============================================================================
// Helper: Perform smart merge with conflict handling
// ============================================================================

export async function performMergeWithConflicts(
  localExpenses: Expense[],
  remoteExpenses: Expense[],
  downloadedSettings?: AppSettings
): Promise<{
  merged: Expense[]
  newFromRemote: number
  updatedFromRemote: number
}> {
  return smartMerge(localExpenses, remoteExpenses)
}
