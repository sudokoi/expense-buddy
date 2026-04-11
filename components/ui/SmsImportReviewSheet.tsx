import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, Card, Input, Label, Text, TextArea, XStack, YStack } from "tamagui"
import type { ViewStyle } from "react-native"
import { useTranslation } from "react-i18next"
import {
  PaymentMethodType,
  type Expense,
  type ExpenseCategory,
} from "../../types/expense"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import {
  useCategories,
  useExpenses,
  useNotifications,
  useSettings,
  useSmsImportReview,
  useUIState,
} from "../../stores/hooks"
import { parseNumericAmount } from "../../utils/amount-input"
import { type SmsImportReviewItem } from "../../types/sms-import"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { CategoryCard } from "./CategoryCard"
import { PaymentMethodCard } from "./PaymentMethodCard"

type EditableSmsImportDraft = {
  amount: string
  category: ExpenseCategory
  note: string
  paymentMethodType?: PaymentMethodType
}

const layoutStyles = {
  categoryRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  paymentMethodRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  actionRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
} as const

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function resolveCategoryLabel(
  item: SmsImportReviewItem,
  availableCategories: Array<{ label: string }>
): ExpenseCategory {
  const labels = new Set(availableCategories.map((category) => category.label))

  if (item.categorySuggestion && labels.has(item.categorySuggestion)) {
    return item.categorySuggestion
  }

  if (labels.has("Other")) {
    return "Other"
  }

  return availableCategories[0]?.label ?? "Other"
}

function createDraftFromItem(
  item: SmsImportReviewItem,
  availableCategories: Array<{ label: string }>
): EditableSmsImportDraft {
  return {
    amount:
      typeof item.amount === "number" && Number.isFinite(item.amount)
        ? String(item.amount)
        : "",
    category: resolveCategoryLabel(item, availableCategories),
    note: item.noteSuggestion ?? item.merchantName ?? "",
    paymentMethodType: item.paymentMethodSuggestion?.type,
  }
}

function buildExpenseFromDraft(
  item: SmsImportReviewItem,
  draft: EditableSmsImportDraft,
  defaultCurrency: string
): Omit<Expense, "id" | "createdAt" | "updatedAt"> | null {
  const parsedAmount = parseNumericAmount(draft.amount, { allowZero: false })
  if (!parsedAmount.success || parsedAmount.value === undefined) {
    return null
  }

  return {
    amount: parsedAmount.value,
    currency: item.currency ?? defaultCurrency,
    category: draft.category,
    date: item.transactionDate ?? item.sourceMessage.receivedAt,
    note: draft.note.trim(),
    paymentMethod: draft.paymentMethodType
      ? {
          type: draft.paymentMethodType,
        }
      : undefined,
  }
}

export function SmsImportReviewSheet() {
  const { t } = useTranslation()
  const { categories } = useCategories()
  const { settings } = useSettings()
  const { addExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const {
    items,
    pendingItems,
    resolvedItems,
    isLoading,
    markItemAccepted,
    markItemRejected,
    dismissItem,
    clearResolvedItems,
  } = useSmsImportReview()
  const { smsImportReviewSheetOpen, setSmsImportReviewSheetOpen } = useUIState()

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditableSmsImportDraft | null>(null)
  const [showResolvedItems, setShowResolvedItems] = useState(false)

  const hasItems = items.length > 0
  const open = smsImportReviewSheetOpen && hasItems
  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [items, editingItemId]
  )

  useEffect(() => {
    if (!isLoading && pendingItems.length > 0) {
      setSmsImportReviewSheetOpen(true)
    }
  }, [isLoading, pendingItems.length, setSmsImportReviewSheetOpen])

  useEffect(() => {
    if (!hasItems && smsImportReviewSheetOpen) {
      setSmsImportReviewSheetOpen(false)
    }
  }, [hasItems, smsImportReviewSheetOpen, setSmsImportReviewSheetOpen])

  const closeSheet = useCallback(() => {
    setSmsImportReviewSheetOpen(false)
    setEditingItemId(null)
    setEditingDraft(null)
  }, [setSmsImportReviewSheetOpen])

  const openEditor = useCallback(
    (item: SmsImportReviewItem) => {
      setEditingItemId(item.id)
      setEditingDraft(createDraftFromItem(item, categories))
    },
    [categories]
  )

  const closeEditor = useCallback(() => {
    setEditingItemId(null)
    setEditingDraft(null)
  }, [])

  const acceptItem = useCallback(
    (item: SmsImportReviewItem, draft: EditableSmsImportDraft) => {
      const expenseDraft = buildExpenseFromDraft(
        item,
        draft,
        settings.defaultCurrency || "INR"
      )

      if (!expenseDraft) {
        addNotification("Enter a valid amount before importing.", "error")
        return false
      }

      const [createdExpense] = addExpenses([expenseDraft])
      markItemAccepted(item.id, createdExpense?.id)
      addNotification("Imported SMS transaction as an expense.", "success")
      return true
    },
    [addExpenses, addNotification, markItemAccepted, settings.defaultCurrency]
  )

  const handleAcceptSuggested = useCallback(
    (item: SmsImportReviewItem) => {
      void acceptItem(item, createDraftFromItem(item, categories))
    },
    [acceptItem, categories]
  )

  const handleAcceptEdited = useCallback(() => {
    if (!editingItem || !editingDraft) {
      return
    }

    const accepted = acceptItem(editingItem, editingDraft)
    if (accepted) {
      closeEditor()
    }
  }, [acceptItem, closeEditor, editingDraft, editingItem])

  const handleAcceptAllSuggested = useCallback(() => {
    const acceptedPairs = pendingItems
      .map((item) => ({
        item,
        expense: buildExpenseFromDraft(
          item,
          createDraftFromItem(item, categories),
          settings.defaultCurrency || "INR"
        ),
      }))
      .filter(
        (
          pair
        ): pair is {
          item: SmsImportReviewItem
          expense: Omit<Expense, "id" | "createdAt" | "updatedAt">
        } => pair.expense !== null
      )

    if (acceptedPairs.length === 0) {
      addNotification("No pending SMS items are ready to import.", "error")
      return
    }

    const createdExpenses = addExpenses(acceptedPairs.map((pair) => pair.expense))

    acceptedPairs.forEach((pair, index) => {
      markItemAccepted(pair.item.id, createdExpenses[index]?.id)
    })

    if (acceptedPairs.length === pendingItems.length) {
      addNotification(
        acceptedPairs.length === 1
          ? "Imported 1 SMS transaction."
          : `Imported ${acceptedPairs.length} SMS transactions.`,
        "success"
      )
    } else {
      addNotification(
        `Imported ${acceptedPairs.length} SMS transactions. Some items still need review.`,
        "info"
      )
    }
  }, [
    addExpenses,
    addNotification,
    categories,
    markItemAccepted,
    pendingItems,
    settings.defaultCurrency,
  ])

  const pendingSubtitle = useMemo(() => {
    if (editingItem) {
      return "Review the parsed details, adjust anything needed, then import the confirmed expense."
    }

    if (pendingItems.length > 0 && resolvedItems.length > 0) {
      return `${pendingItems.length} pending and ${resolvedItems.length} resolved SMS imports.`
    }

    if (pendingItems.length > 0) {
      return `${pendingItems.length} pending SMS imports ready for review.`
    }

    return `${resolvedItems.length} resolved SMS imports kept locally.`
  }, [editingItem, pendingItems.length, resolvedItems.length])

  if (!hasItems) {
    return null
  }

  return (
    <AppSheetScaffold
      open={open}
      onClose={closeSheet}
      title={editingItem ? "Edit SMS Import" : "Review SMS Imports"}
      subtitle={pendingSubtitle}
      snapPoints={[92]}
      scroll
      footer={
        editingItem ? (
          <XStack justify="flex-end" gap="$2">
            <Button onPress={closeEditor}>{t("common.cancel")}</Button>
            <Button themeInverse onPress={handleAcceptEdited}>
              Save and Import
            </Button>
          </XStack>
        ) : pendingItems.length > 1 ? (
          <XStack justify="space-between" gap="$2">
            <Button onPress={() => setShowResolvedItems((current) => !current)}>
              {showResolvedItems ? "Hide resolved" : "Show resolved"}
            </Button>
            <Button themeInverse onPress={handleAcceptAllSuggested}>
              Accept All Suggested
            </Button>
          </XStack>
        ) : resolvedItems.length > 0 ? (
          <XStack justify="space-between" gap="$2">
            <Button onPress={() => setShowResolvedItems((current) => !current)}>
              {showResolvedItems ? "Hide resolved" : "Show resolved"}
            </Button>
            <Button onPress={clearResolvedItems}>Clear resolved</Button>
          </XStack>
        ) : undefined
      }
    >
      {editingItem && editingDraft ? (
        <YStack gap="$4" pb="$6">
          <Card bordered padding="$3" backgroundColor="$backgroundHover">
            <YStack gap="$2">
              <Text fontWeight="700">Source SMS</Text>
              <Text fontSize="$3" opacity={0.7}>
                {editingItem.sourceMessage.sender || "Unknown sender"}
              </Text>
              <Text fontSize="$2" opacity={0.6}>
                {formatTimestamp(editingItem.sourceMessage.receivedAt)}
              </Text>
              <Text>{editingItem.sourceMessage.body}</Text>
            </YStack>
          </Card>

          <YStack gap="$2">
            <Label>Amount</Label>
            <Input
              keyboardType="numeric"
              value={editingDraft.amount}
              onChangeText={(amount) => {
                setEditingDraft((current) =>
                  current
                    ? {
                        ...current,
                        amount,
                      }
                    : current
                )
              }}
            />
          </YStack>

          <YStack gap="$2">
            <Label>Category</Label>
            <XStack style={layoutStyles.categoryRow}>
              {categories.map((category) => (
                <CategoryCard
                  key={category.label}
                  compact
                  isSelected={editingDraft.category === category.label}
                  categoryColor={category.color}
                  label={category.label}
                  onPress={() => {
                    setEditingDraft((current) =>
                      current
                        ? {
                            ...current,
                            category: category.label,
                          }
                        : current
                    )
                  }}
                />
              ))}
            </XStack>
          </YStack>

          <YStack gap="$2">
            <Label>Payment method</Label>
            <XStack style={layoutStyles.paymentMethodRow}>
              <Button
                bg={editingDraft.paymentMethodType ? "$background" : "$backgroundHover"}
                borderColor={editingDraft.paymentMethodType ? "$borderColor" : "$color8"}
                borderWidth={editingDraft.paymentMethodType ? 1 : 2}
                onPress={() => {
                  setEditingDraft((current) =>
                    current
                      ? {
                          ...current,
                          paymentMethodType: undefined,
                        }
                      : current
                  )
                }}
              >
                None
              </Button>

              {PAYMENT_METHODS.map((config) => (
                <PaymentMethodCard
                  key={config.value}
                  config={config}
                  isSelected={editingDraft.paymentMethodType === config.value}
                  onPress={() => {
                    setEditingDraft((current) =>
                      current
                        ? {
                            ...current,
                            paymentMethodType: config.value,
                          }
                        : current
                    )
                  }}
                />
              ))}
            </XStack>
          </YStack>

          <YStack gap="$2">
            <Label>Note</Label>
            <TextArea
              minH={100}
              value={editingDraft.note}
              onChangeText={(note) => {
                setEditingDraft((current) =>
                  current
                    ? {
                        ...current,
                        note,
                      }
                    : current
                )
              }}
            />
          </YStack>
        </YStack>
      ) : (
        <YStack gap="$4" pb="$6">
          {pendingItems.length > 0 ? (
            <YStack gap="$3">
              <Text fontWeight="700">Pending review</Text>

              {pendingItems.map((item) => (
                <Card key={item.id} bordered padding="$3">
                  <YStack gap="$3">
                    <YStack gap="$1">
                      <Text fontWeight="700">
                        {item.merchantName || item.sourceMessage.sender}
                      </Text>
                      <Text fontSize="$2" opacity={0.6}>
                        {formatTimestamp(item.sourceMessage.receivedAt)}
                      </Text>
                    </YStack>

                    <YStack gap="$1">
                      <Text>
                        Amount:{" "}
                        {typeof item.amount === "number"
                          ? `${item.currency || settings.defaultCurrency || "INR"} ${item.amount}`
                          : "Needs review"}
                      </Text>
                      <Text>
                        Category:{" "}
                        {item.categorySuggestion ||
                          resolveCategoryLabel(item, categories)}
                      </Text>
                      <Text>Payment: {item.paymentMethodSuggestion?.type || "None"}</Text>
                      <Text numberOfLines={3} opacity={0.75}>
                        {item.sourceMessage.body}
                      </Text>
                    </YStack>

                    <XStack style={layoutStyles.actionRow}>
                      <Button themeInverse onPress={() => handleAcceptSuggested(item)}>
                        Accept
                      </Button>
                      <Button onPress={() => openEditor(item)}>Edit</Button>
                      <Button
                        theme="red"
                        onPress={() => {
                          markItemRejected(item.id)
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        onPress={() => {
                          dismissItem(item.id)
                        }}
                      >
                        Dismiss
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              ))}
            </YStack>
          ) : null}

          {resolvedItems.length > 0 && showResolvedItems ? (
            <YStack gap="$3">
              <XStack justify="space-between" items="center">
                <Text fontWeight="700">Resolved</Text>
                <Button size="$3" onPress={clearResolvedItems}>
                  Clear resolved
                </Button>
              </XStack>

              {resolvedItems.map((item) => (
                <Card key={item.id} bordered padding="$3" opacity={0.8}>
                  <YStack gap="$2">
                    <Text fontWeight="700">
                      {item.merchantName || item.sourceMessage.sender}
                    </Text>
                    <Text fontSize="$2" opacity={0.6}>
                      {formatTimestamp(item.sourceMessage.receivedAt)}
                    </Text>
                    <Text>Status: {item.status}</Text>
                    <Text numberOfLines={2} opacity={0.75}>
                      {item.sourceMessage.body}
                    </Text>
                  </YStack>
                </Card>
              ))}
            </YStack>
          ) : null}

          {pendingItems.length === 0 && resolvedItems.length > 0 && !showResolvedItems ? (
            <Card bordered padding="$3" backgroundColor="$backgroundHover">
              <Text opacity={0.75}>
                All current SMS imports are resolved. Use Show resolved to review or clear
                them.
              </Text>
            </Card>
          ) : null}
        </YStack>
      )}
    </AppSheetScaffold>
  )
}
