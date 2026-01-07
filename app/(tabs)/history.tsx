import React from "react"
import { YStack, Text, XStack, H4, Button, H6, Input, Dialog, Label } from "tamagui"
import { Calendar } from "@tamagui/lucide-icons"
import { SectionList, Platform, ViewStyle, TextStyle, BackHandler } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useExpenses, useNotifications, useSettings, useCategories } from "../../stores"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { Trash, Edit3 } from "@tamagui/lucide-icons"
import { format, parseISO } from "date-fns"
import type {
  ExpenseCategory,
  Expense,
  PaymentMethodType,
  PaymentMethod,
} from "../../types/expense"
import { syncDownMore } from "../../services/sync-manager"
import {
  parseExpression,
  hasOperators,
  formatAmount,
} from "../../utils/expression-parser"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { formatPaymentMethodDisplay } from "../../utils/payment-method-display"
import {
  ExpenseCard,
  AmountText,
  CategoryCard,
  PaymentMethodCard,
  DynamicCategoryIcon,
} from "../../components/ui"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  } as ViewStyle,
  emptyText: {
    fontSize: 24,
  } as TextStyle,
  emptySubtext: {
    fontSize: 16,
    marginTop: 8,
  } as TextStyle,
  mainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  } as ViewStyle,
  header: {
    marginBottom: 16,
  } as TextStyle,
  dialogButtonRow: {
    justifyContent: "flex-end",
  } as ViewStyle,
  editDialogButtonRow: {
    justifyContent: "flex-end",
    marginTop: 16,
  } as ViewStyle,
  sectionHeader: {
    paddingVertical: 8,
  } as ViewStyle,
  expenseDetails: {
    alignItems: "center",
  } as ViewStyle,
  actionButtons: {
    alignItems: "center",
  } as ViewStyle,
  loadMoreContainer: {
    padding: 16,
    alignItems: "center",
  } as ViewStyle,
  categoryRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  paymentMethodRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
}

// Memoized expense list item component
interface ExpenseListItemProps {
  item: Expense
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

const ExpenseListItem = React.memo(function ExpenseListItem({
  item,
  onEdit,
  onDelete,
}: ExpenseListItemProps) {
  const { getCategoryByLabel } = useCategories()
  const categoryInfo = getCategoryByLabel(item.category)

  if (!categoryInfo) {
    return null
  }

  // Use utility function for consistent payment method display
  const paymentMethodDisplay = formatPaymentMethodDisplay(item.paymentMethod)

  return (
    <ExpenseCard>
      <XStack flex={1} gap="$3" style={layoutStyles.expenseDetails}>
        <DynamicCategoryIcon
          name={categoryInfo.icon}
          size={20}
          color={categoryInfo.color as `#${string}`}
        />
        <YStack flex={1}>
          <Text fontWeight="bold" fontSize="$4">
            {item.note || categoryInfo.label}
          </Text>
          <Text color="$color" opacity={0.6} fontSize="$2">
            {format(parseISO(item.date), "h:mm a")} • {categoryInfo.label}
          </Text>
          {paymentMethodDisplay && (
            <Text color="$color" opacity={0.5} fontSize="$2">
              {paymentMethodDisplay}
            </Text>
          )}
        </YStack>
      </XStack>

      <XStack gap="$3" style={layoutStyles.actionButtons}>
        <AmountText type="expense">-₹{item.amount.toFixed(2)}</AmountText>
        <Button
          size="$2"
          icon={Edit3}
          chromeless
          onPress={() => onEdit(item)}
          aria-label="Edit"
        />
        <Button
          size="$2"
          icon={Trash}
          chromeless
          onPress={() => onDelete(item.id)}
          aria-label="Delete"
        />
      </XStack>
    </ExpenseCard>
  )
})

export default function HistoryScreen() {
  const { state, deleteExpense, editExpense, replaceAllExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const { syncConfig } = useSettings()
  const { categories } = useCategories()
  const insets = useSafeAreaInsets()
  const [editingExpense, setEditingExpense] = React.useState<{
    id: string
    amount: string
    category: ExpenseCategory
    note: string
    date: string // ISO date string
    paymentMethodType?: PaymentMethodType
    paymentMethodId: string
  } | null>(null)
  const [showDatePicker, setShowDatePicker] = React.useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)

  // Handle back button to close dialogs instead of navigating
  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editingExpense) {
        setEditingExpense(null)
        setShowDatePicker(false)
        return true // Prevent default back behavior
      }
      if (deletingExpenseId) {
        setDeletingExpenseId(null)
        return true // Prevent default back behavior
      }
      return false // Let default back behavior happen
    })

    return () => backHandler.remove()
  }, [editingExpense, deletingExpenseId])

  // Compute preview when expression contains operators
  const expressionPreview = React.useMemo(() => {
    if (!editingExpense?.amount.trim() || !hasOperators(editingExpense.amount)) {
      return null
    }
    const result = parseExpression(editingExpense.amount)
    if (result.success && result.value !== undefined) {
      return formatAmount(result.value)
    }
    return null
  }, [editingExpense?.amount])

  // Get current payment method config for identifier input in edit dialog
  const selectedPaymentConfig = React.useMemo(() => {
    if (!editingExpense?.paymentMethodType) return null
    return (
      PAYMENT_METHODS.find((pm) => pm.value === editingExpense.paymentMethodType) || null
    )
  }, [editingExpense?.paymentMethodType])

  // Memoized category selection handler for edit dialog
  const handleCategorySelect = React.useCallback((category: ExpenseCategory) => {
    setEditingExpense((prev) => (prev ? { ...prev, category } : null))
  }, [])

  const handlePaymentMethodSelect = React.useCallback((type: PaymentMethodType) => {
    setEditingExpense((prev) => {
      if (!prev) return null
      if (prev.paymentMethodType === type) {
        // Deselect if already selected
        return { ...prev, paymentMethodType: undefined, paymentMethodId: "" }
      } else {
        return { ...prev, paymentMethodType: type, paymentMethodId: "" }
      }
    })
  }, [])

  const handleIdentifierChange = React.useCallback(
    (text: string) => {
      setEditingExpense((prev) => {
        if (!prev) return null
        // For "Other" payment method, allow any text (description)
        // For other payment methods, use the validated identifier utility function
        if (prev.paymentMethodType === "Other") {
          const maxLen = selectedPaymentConfig?.maxLength || 50
          return { ...prev, paymentMethodId: text.slice(0, maxLen) }
        } else {
          const maxLen = selectedPaymentConfig?.maxLength || 4
          return { ...prev, paymentMethodId: validateIdentifier(text, maxLen) }
        }
      })
    },
    [selectedPaymentConfig?.maxLength]
  )

  const groupedExpenses = React.useMemo(() => {
    const grouped: { title: string; data: Expense[] }[] = []
    // Use activeExpenses (excludes soft-deleted) for display
    const sorted = [...state.activeExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    sorted.forEach((expense) => {
      const dateKey = format(parseISO(expense.date), "dd/MM/yyyy")
      const existing = grouped.find((g) => g.title === dateKey)
      if (existing) {
        existing.data.push(expense)
      } else {
        grouped.push({ title: dateKey, data: [expense] })
      }
    })
    return grouped
  }, [state.activeExpenses])

  // Memoized handlers for list item actions
  const handleEdit = React.useCallback((expense: Expense) => {
    setEditingExpense({
      id: expense.id,
      amount: expense.amount.toString(),
      category: expense.category,
      note: expense.note || "",
      date: expense.date,
      paymentMethodType: expense.paymentMethod?.type,
      paymentMethodId: expense.paymentMethod?.identifier || "",
    })
  }, [])

  const handleDelete = React.useCallback((id: string) => {
    setDeletingExpenseId(id)
  }, [])

  const confirmDelete = React.useCallback(() => {
    if (deletingExpenseId) {
      deleteExpense(deletingExpenseId)
      addNotification("Expense deleted", "success")
      setDeletingExpenseId(null)
    }
  }, [deletingExpenseId, deleteExpense, addNotification])

  const handleLoadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      const result = await syncDownMore(state.expenses, 7)

      if (result.success && result.expenses) {
        replaceAllExpenses(result.expenses)
        setHasMore(result.hasMore || false)
        addNotification(result.message, "success")
      } else {
        addNotification(result.error || result.message, "error")
      }
    } catch {
      addNotification("Failed to load more expenses", "error")
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, state.expenses, replaceAllExpenses, addNotification])

  // Memoized renderItem function
  const renderItem = React.useCallback(
    ({ item }: { item: Expense }) => (
      <ExpenseListItem item={item} onEdit={handleEdit} onDelete={handleDelete} />
    ),
    [handleEdit, handleDelete]
  )

  // Memoized renderSectionHeader function
  const renderSectionHeader = React.useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <YStack background="$background" style={layoutStyles.sectionHeader}>
        <H6 color="$color" opacity={0.8}>
          {title}
        </H6>
      </YStack>
    ),
    []
  )

  // Memoized keyExtractor
  const keyExtractor = React.useCallback((item: Expense) => item.id, [])

  // Memoized ListFooterComponent - only show if GitHub is configured and there's more data
  const ListFooterComponent = React.useMemo(
    () =>
      hasMore && syncConfig ? (
        <YStack style={layoutStyles.loadMoreContainer}>
          <Button
            size="$4"
            themeInverse
            onPress={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </Button>
        </YStack>
      ) : null,
    [hasMore, syncConfig, handleLoadMore, isLoadingMore]
  )

  // Memoized content container style
  const contentContainerStyle = React.useMemo(
    () => ({ paddingBottom: insets.bottom }),
    [insets.bottom]
  )

  // Memoized save handler for edit dialog
  const handleSaveEdit = React.useCallback(() => {
    if (editingExpense) {
      // Use activeExpenses for finding the expense to edit (soft-deleted expenses shouldn't be editable)
      const expense = state.activeExpenses.find((e) => e.id === editingExpense.id)
      if (expense) {
        if (!editingExpense.amount.trim()) {
          addNotification("Please enter a valid amount", "error")
          return
        }

        const result = parseExpression(editingExpense.amount)

        if (!result.success) {
          addNotification(result.error || "Please enter a valid expression", "error")
          return
        }

        // Build payment method object if type is selected
        const paymentMethod: PaymentMethod | undefined = editingExpense.paymentMethodType
          ? {
              type: editingExpense.paymentMethodType,
              identifier: editingExpense.paymentMethodId.trim() || undefined,
            }
          : undefined

        editExpense(editingExpense.id, {
          amount: result.value!,
          category: editingExpense.category,
          date: editingExpense.date,
          note: editingExpense.note,
          paymentMethod,
        })
        addNotification("Expense updated", "success")
        setEditingExpense(null)
        setShowDatePicker(false)
      }
    }
  }, [editingExpense, state.activeExpenses, editExpense, addNotification])

  if (state.activeExpenses.length === 0) {
    return (
      <YStack flex={1} bg="$background" style={layoutStyles.emptyContainer}>
        <Text style={layoutStyles.emptyText} color="$color" opacity={0.8}>
          No expenses yet.
        </Text>
        <Text style={layoutStyles.emptySubtext} color="$color" opacity={0.6}>
          Add one from the Add Expense tab.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background" style={layoutStyles.mainContainer}>
      <H4 style={layoutStyles.header}>Expense History</H4>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingExpenseId}
        onOpenChange={(open) => !open && setDeletingExpenseId(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay key="overlay" opacity={0.5} />
          <Dialog.Content bordered elevate key="content" gap="$4">
            <Dialog.Title size="$6">Delete Expense</Dialog.Title>
            <Dialog.Description>
              Are you sure you want to delete this expense? This action cannot be undone.
            </Dialog.Description>
            <XStack gap="$3" style={layoutStyles.dialogButtonRow}>
              <Dialog.Close asChild>
                <Button size="$4">Cancel</Button>
              </Dialog.Close>
              <Button size="$4" theme="red" onPress={confirmDelete}>
                Delete
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog
        open={!!editingExpense}
        onOpenChange={(open) => {
          if (!open) {
            setEditingExpense(null)
            setShowDatePicker(false)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay key="overlay" opacity={0.5} />
          <Dialog.Content
            bordered
            elevate
            key="content"
            // @ts-expect-error maxHeight works at runtime but isn't in Dialog.Content types
            maxHeight="80%"
            gap="$4"
          >
            <Dialog.Title size="$6">Edit Expense</Dialog.Title>
            <Dialog.Description>Update the expense details</Dialog.Description>

            <KeyboardAwareScrollView
              bottomOffset={20}
              contentContainerStyle={{ paddingBottom: insets.bottom }}
            >
              <YStack gap="$3">
                <YStack gap="$2">
                  <Label color="$color" opacity={0.8} htmlFor="date">
                    Date
                  </Label>
                  <Button
                    size="$4"
                    onPress={() => setShowDatePicker(true)}
                    icon={Calendar}
                  >
                    {editingExpense?.date
                      ? format(parseISO(editingExpense.date), "dd/MM/yyyy")
                      : "Select date"}
                  </Button>
                  {showDatePicker && (
                    <DateTimePicker
                      value={
                        editingExpense?.date ? parseISO(editingExpense.date) : new Date()
                      }
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === "ios")
                        if (selectedDate && event.type !== "dismissed") {
                          const originalDate = editingExpense?.date
                            ? parseISO(editingExpense.date)
                            : new Date()
                          selectedDate.setHours(
                            originalDate.getHours(),
                            originalDate.getMinutes(),
                            originalDate.getSeconds(),
                            originalDate.getMilliseconds()
                          )
                          setEditingExpense((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  date: selectedDate.toISOString(),
                                }
                              : null
                          )
                        }
                      }}
                    />
                  )}
                  {showDatePicker && Platform.OS === "ios" && (
                    <Button size="$4" onPress={() => setShowDatePicker(false)}>
                      Done
                    </Button>
                  )}
                </YStack>

                <YStack gap="$2">
                  <Label color="$color" opacity={0.8} htmlFor="amount">
                    Amount (₹)
                  </Label>
                  <Input
                    id="amount"
                    value={editingExpense?.amount || ""}
                    onChangeText={(text) =>
                      setEditingExpense((prev) =>
                        prev ? { ...prev, amount: text } : null
                      )
                    }
                    placeholder="Enter amount or expression (e.g., 100+50)"
                    keyboardType="default"
                  />
                  {expressionPreview && (
                    <Text fontSize="$3" color="$color" opacity={0.7}>
                      = ₹{expressionPreview}
                    </Text>
                  )}
                </YStack>

                <YStack gap="$2">
                  <Label color="$color" opacity={0.8}>
                    Category
                  </Label>
                  <XStack style={layoutStyles.categoryRow}>
                    {categories.map((cat) => {
                      const isSelected = editingExpense?.category === cat.label
                      return (
                        <CategoryCard
                          key={cat.label}
                          isSelected={isSelected}
                          categoryColor={cat.color}
                          label={cat.label}
                          onPress={() => handleCategorySelect(cat.label)}
                          compact
                        />
                      )
                    })}
                  </XStack>
                </YStack>

                <YStack gap="$2">
                  <Label color="$color" opacity={0.8} htmlFor="note">
                    Note
                  </Label>
                  <Input
                    id="note"
                    value={editingExpense?.note || ""}
                    onChangeText={(text) =>
                      setEditingExpense((prev) => (prev ? { ...prev, note: text } : null))
                    }
                    placeholder="Enter note (optional)"
                  />
                </YStack>

                {/* Payment Method Selection */}
                <YStack gap="$2">
                  <Label color="$color" opacity={0.8}>
                    Payment Method (Optional)
                  </Label>
                  <XStack style={layoutStyles.paymentMethodRow}>
                    {PAYMENT_METHODS.map((pm) => (
                      <PaymentMethodCard
                        key={pm.value}
                        config={pm}
                        isSelected={editingExpense?.paymentMethodType === pm.value}
                        onPress={() => handlePaymentMethodSelect(pm.value)}
                      />
                    ))}
                  </XStack>

                  {/* Identifier input for cards/UPI/Other */}
                  {selectedPaymentConfig?.hasIdentifier && (
                    <YStack gap="$1" style={{ marginTop: 8 }}>
                      <Label color="$color" opacity={0.6} fontSize="$2">
                        {selectedPaymentConfig.identifierLabel} (Optional)
                      </Label>
                      <Input
                        size="$4"
                        placeholder={
                          editingExpense?.paymentMethodType === "Other"
                            ? "e.g., Venmo, PayPal, Gift Card"
                            : `Enter ${selectedPaymentConfig.maxLength} digits`
                        }
                        keyboardType={
                          editingExpense?.paymentMethodType === "Other"
                            ? "default"
                            : "numeric"
                        }
                        value={editingExpense?.paymentMethodId || ""}
                        onChangeText={handleIdentifierChange}
                        maxLength={selectedPaymentConfig.maxLength}
                      />
                    </YStack>
                  )}
                </YStack>
              </YStack>

              <XStack gap="$3" style={layoutStyles.editDialogButtonRow}>
                <Dialog.Close asChild>
                  <Button size="$4">Cancel</Button>
                </Dialog.Close>
                <Button size="$4" themeInverse onPress={handleSaveEdit}>
                  Save
                </Button>
              </XStack>
            </KeyboardAwareScrollView>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <SectionList
        sections={groupedExpenses}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={ListFooterComponent}
      />
    </YStack>
  )
}
