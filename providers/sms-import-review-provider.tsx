import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react"
import { SmsImportReviewItem } from "../types/sms-import"
import {
  getPendingReviewQueueAsync,
  approveReviewItemAsync,
  approveReviewItemsAsync,
  rejectReviewItemAsync,
  rejectReviewItemsAsync,
  dismissReviewItemAsync,
  dismissReviewItemsAsync,
  dismissNotificationAsync,
} from "../services/background-sms/android-background-sms-module"
import ExpenseBuddySmsModule from "../modules/expense-buddy-sms-module"
import { createSnapshotRefresher } from "../utils/snapshot-refresher"

interface SmsImportReviewContextValue {
  items: SmsImportReviewItem[]
  pendingItems: SmsImportReviewItem[]
  resolvedItems: SmsImportReviewItem[]
  isLoading: boolean
  refreshItems: () => Promise<void>
  markItemAccepted: (fingerprint: string) => Promise<void>
  markItemsAccepted: (fingerprints: string[]) => Promise<void>
  markItemsRejected: (fingerprints: string[]) => Promise<void>
  markItemRejected: (fingerprint: string) => Promise<void>
  markItemsDismissed: (fingerprints: string[]) => Promise<void>
  dismissItem: (fingerprint: string) => Promise<void>
  clearResolvedItems: () => void
}

const SmsImportReviewContext = createContext<SmsImportReviewContextValue | null>(null)

export const SmsImportReviewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<SmsImportReviewItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const refresherRef = useRef<ReturnType<
    typeof createSnapshotRefresher<SmsImportReviewItem[]>
  > | null>(null)

  const fetchItems = useCallback(async () => {
    await refresherRef.current?.refresh()
  }, [])

  useEffect(() => {
    const refresher = createSnapshotRefresher({
      load: getPendingReviewQueueAsync,
      publish: setItems,
      loading: setIsLoading,
      onError: (error) => console.warn("Failed to fetch pending review queue", error),
    })
    refresherRef.current = refresher
    let timer: ReturnType<typeof setTimeout> | undefined
    const subscription = ExpenseBuddySmsModule?.addListener(
      "onReviewQueueUpdated",
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          void refresher.refresh()
        }, 300)
      }
    )
    void refresher.refresh()
    return () => {
      subscription?.remove()
      clearTimeout(timer)
      refresher.dispose()
      refresherRef.current = null
    }
  }, [])

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items]
  )

  const resolvedItems = useMemo(
    () => items.filter((item) => item.status !== "pending"),
    [items]
  )

  const refreshItems = useCallback(async () => {
    await fetchItems()
  }, [fetchItems])

  // Accepting an item is a two-step write across the seam: the JS expense store
  // owns the resulting expense, while the native queue owns the review status.
  // Only the fingerprint crosses the seam here — the expense id stays on the JS
  // side, so the queue never needs to know how the accepted expense was stored.
  const markItemAccepted = useCallback(async (fingerprint: string) => {
    await approveReviewItemAsync(fingerprint)
    void dismissNotificationAsync()
  }, [])

  const markItemsAccepted = useCallback(async (fingerprints: string[]) => {
    await approveReviewItemsAsync(fingerprints)
    void dismissNotificationAsync()
  }, [])

  const markItemsRejected = useCallback(async (fingerprints: string[]) => {
    await rejectReviewItemsAsync(fingerprints)
    void dismissNotificationAsync()
  }, [])

  const markItemRejected = useCallback(async (fingerprint: string) => {
    await rejectReviewItemAsync(fingerprint)
    void dismissNotificationAsync()
  }, [])

  const markItemsDismissed = useCallback(async (fingerprints: string[]) => {
    await dismissReviewItemsAsync(fingerprints)
    void dismissNotificationAsync()
  }, [])

  const dismissItem = useCallback(async (fingerprint: string) => {
    await dismissReviewItemAsync(fingerprint)
    void dismissNotificationAsync()
  }, [])

  const clearResolvedItems = useCallback(() => {
    fetchItems()
  }, [fetchItems])

  const value = useMemo(
    () => ({
      items,
      pendingItems,
      resolvedItems,
      isLoading,
      markItemAccepted,
      markItemsAccepted,
      markItemsRejected,
      markItemRejected,
      markItemsDismissed,
      dismissItem,
      clearResolvedItems,
      refreshItems,
    }),
    [
      items,
      pendingItems,
      resolvedItems,
      isLoading,
      markItemAccepted,
      markItemsAccepted,
      markItemsRejected,
      markItemRejected,
      markItemsDismissed,
      dismissItem,
      clearResolvedItems,
      refreshItems,
    ]
  )

  return (
    <SmsImportReviewContext.Provider value={value}>
      {children}
    </SmsImportReviewContext.Provider>
  )
}

export const useSmsImportReview = () => {
  const context = useContext(SmsImportReviewContext)
  if (!context) {
    throw new Error("useSmsImportReview must be used within a SmsImportReviewProvider")
  }
  return context
}
