import { useCallback, useMemo } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"
import { SmsImportReviewItem } from "../../types/sms-import"

export const useSmsImportReview = () => {
  const { smsImportReviewStore } = useStoreContext()

  const items = useSelector(smsImportReviewStore, (state) => state.context.items)
  const isLoading = useSelector(smsImportReviewStore, (state) => state.context.isLoading)
  const lastScanCursor = useSelector(
    smsImportReviewStore,
    (state) => state.context.lastScanCursor
  )
  const bootstrapCompletedAt = useSelector(
    smsImportReviewStore,
    (state) => state.context.bootstrapCompletedAt
  )

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items]
  )
  const resolvedItems = useMemo(
    () => items.filter((item) => item.status !== "pending"),
    [items]
  )

  const upsertReviewItems = useCallback(
    (
      nextItems: SmsImportReviewItem[],
      options?: { lastScanCursor?: string | null; bootstrapCompletedAt?: string | null }
    ) => {
      smsImportReviewStore.trigger.upsertReviewItems({
        items: nextItems,
        lastScanCursor: options?.lastScanCursor,
        bootstrapCompletedAt: options?.bootstrapCompletedAt,
      })
    },
    [smsImportReviewStore]
  )

  const markItemAccepted = useCallback(
    (fingerprint: string, acceptedExpenseId?: string) => {
      smsImportReviewStore.trigger.markItemAccepted({ fingerprint, acceptedExpenseId })
    },
    [smsImportReviewStore]
  )

  const markItemsAccepted = useCallback(
    (acceptedItems: Array<{ fingerprint: string; acceptedExpenseId?: string }>) => {
      smsImportReviewStore.trigger.markItemsAccepted({ acceptedItems })
    },
    [smsImportReviewStore]
  )

  const markItemsRejected = useCallback(
    (fingerprints: string[]) => {
      smsImportReviewStore.trigger.markItemsRejected({ fingerprints })
    },
    [smsImportReviewStore]
  )

  const markItemRejected = useCallback(
    (fingerprint: string) => {
      smsImportReviewStore.trigger.markItemRejected({ fingerprint })
    },
    [smsImportReviewStore]
  )

  const markItemsDismissed = useCallback(
    (fingerprints: string[]) => {
      smsImportReviewStore.trigger.markItemsDismissed({ fingerprints })
    },
    [smsImportReviewStore]
  )

  const dismissItem = useCallback(
    (fingerprint: string) => {
      smsImportReviewStore.trigger.dismissItem({ fingerprint })
    },
    [smsImportReviewStore]
  )

  const clearResolvedItems = useCallback(() => {
    smsImportReviewStore.trigger.clearResolvedItems()
  }, [smsImportReviewStore])

  const setLastScanCursor = useCallback(
    (cursor: string | null) => {
      smsImportReviewStore.trigger.setLastScanCursor({ cursor })
    },
    [smsImportReviewStore]
  )

  const setBootstrapCompletedAt = useCallback(
    (completedAt: string | null) => {
      smsImportReviewStore.trigger.setBootstrapCompletedAt({ completedAt })
    },
    [smsImportReviewStore]
  )

  return {
    items,
    pendingItems,
    resolvedItems,
    isLoading,
    lastScanCursor,
    bootstrapCompletedAt,
    upsertReviewItems,
    markItemAccepted,
    markItemsAccepted,
    markItemsRejected,
    markItemRejected,
    markItemsDismissed,
    dismissItem,
    clearResolvedItems,
    setLastScanCursor,
    setBootstrapCompletedAt,
  }
}
