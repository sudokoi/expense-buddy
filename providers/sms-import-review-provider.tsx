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

interface SmsImportReviewContextValue {
  items: SmsImportReviewItem[]
  pendingItems: SmsImportReviewItem[]
  resolvedItems: SmsImportReviewItem[]
  isLoading: boolean
  refreshItems: () => Promise<void>
  markItemAccepted: (fingerprint: string, acceptedExpenseId?: string) => Promise<void>
  markItemsAccepted: (
    acceptedItems: Array<{ fingerprint: string; acceptedExpenseId?: string }>
  ) => Promise<void>
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
  const isFetchingRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchItems = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      setIsLoading(true)
      const data = await getPendingReviewQueueAsync()
      setItems(data)
    } catch (error) {
      console.warn("Failed to fetch pending review queue", error)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (!ExpenseBuddySmsModule) return

    const subscription = ExpenseBuddySmsModule.addListener("onReviewQueueUpdated", () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        void fetchItems()
      }, 300)
    })

    return () => {
      subscription.remove()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [fetchItems])

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

  const markItemAccepted = useCallback(async (fingerprint: string) => {
    await approveReviewItemAsync(fingerprint)
    void dismissNotificationAsync()
  }, [])

  const markItemsAccepted = useCallback(
    async (acceptedItems: Array<{ fingerprint: string; acceptedExpenseId?: string }>) => {
      await approveReviewItemsAsync(acceptedItems.map((i) => i.fingerprint))
      void dismissNotificationAsync()
    },
    []
  )

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
