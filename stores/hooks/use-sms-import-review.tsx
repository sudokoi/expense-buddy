import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react"
import { SmsImportReviewItem } from "../../types/sms-import"
import {
  getPendingReviewQueueAsync,
  approveReviewItemAsync,
  approveReviewItemsAsync,
  rejectReviewItemAsync,
  rejectReviewItemsAsync,
  dismissReviewItemAsync,
  dismissReviewItemsAsync,
} from "../../services/background-sms/android-background-sms-module"
import ExpenseBuddyBackgroundSmsModule from "../../modules/expense-buddy-background-sms"

interface SmsImportReviewContextValue {
  items: SmsImportReviewItem[]
  pendingItems: SmsImportReviewItem[]
  resolvedItems: SmsImportReviewItem[]
  isLoading: boolean
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

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getPendingReviewQueueAsync()
      setItems(data)
    } catch (error) {
      console.warn("Failed to fetch pending review queue", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (!ExpenseBuddyBackgroundSmsModule) return

    const subscription = ExpenseBuddyBackgroundSmsModule.addListener(
      "onReviewQueueUpdated",
      () => {
        fetchItems()
      }
    )

    return () => subscription.remove()
  }, [fetchItems])

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items]
  )

  const resolvedItems = useMemo(
    () => items.filter((item) => item.status !== "pending"),
    [items]
  )

  const markItemAccepted = useCallback(async (fingerprint: string) => {
    await approveReviewItemAsync(fingerprint)
  }, [])

  const markItemsAccepted = useCallback(
    async (acceptedItems: Array<{ fingerprint: string }>) => {
      await approveReviewItemsAsync(acceptedItems.map((i) => i.fingerprint))
    },
    []
  )

  const markItemsRejected = useCallback(async (fingerprints: string[]) => {
    await rejectReviewItemsAsync(fingerprints)
  }, [])

  const markItemRejected = useCallback(async (fingerprint: string) => {
    await rejectReviewItemAsync(fingerprint)
  }, [])

  const markItemsDismissed = useCallback(async (fingerprints: string[]) => {
    await dismissReviewItemsAsync(fingerprints)
  }, [])

  const dismissItem = useCallback(async (fingerprint: string) => {
    await dismissReviewItemAsync(fingerprint)
  }, [])

  const clearResolvedItems = useCallback(() => {
    // Resolved items are cleared from the queue inherently because the native DB query
    // `getPendingReviewQueueAsync` only fetches pending items anyway.
    // If the UI wants to clear its local display of them, we just refetch to get the latest pending.
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
