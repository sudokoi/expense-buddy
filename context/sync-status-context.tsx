import React, { createContext, useContext, useState, useCallback } from "react"

export type SyncStatus = "idle" | "syncing" | "success" | "error"

interface SyncStatusContextType {
  syncStatus: SyncStatus
  isSyncing: boolean
  setSyncStatus: (status: SyncStatus) => void
  startSync: () => void
  endSync: (success: boolean) => void
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined)

export const SyncStatusProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")

  const startSync = useCallback(() => {
    setSyncStatus("syncing")
  }, [])

  const endSync = useCallback((success: boolean) => {
    setSyncStatus(success ? "success" : "error")

    // Auto-reset success status after 2 seconds
    if (success) {
      setTimeout(() => {
        setSyncStatus("idle")
      }, 2000)
    }
  }, [])

  const isSyncing = syncStatus === "syncing"

  return (
    <SyncStatusContext.Provider
      value={{ syncStatus, isSyncing, setSyncStatus, startSync, endSync }}
    >
      {children}
    </SyncStatusContext.Provider>
  )
}

export const useSyncStatus = () => {
  const context = useContext(SyncStatusContext)
  if (!context) {
    throw new Error("useSyncStatus must be used within SyncStatusProvider")
  }
  return context
}
