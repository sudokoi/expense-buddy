import React from "react"
import { YStack, Text, XStack, H4, Button, H6, Input, Dialog, Label } from "tamagui"
import { Calendar } from "@tamagui/lucide-icons"
import { SectionList, Platform, ViewStyle, TextStyle, BackHandler } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DateTimePicker from "@react-native-community/datetimepicker"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useCategories,
} from "../../stores/hooks"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { parseISO } from "date-fns"
import { getLocalDayKey, formatDate } from "../../utils/date"
import { getCurrencySymbol, getFallbackCurrency } from "../../utils/currency"
import type {
  ExpenseCategory,
  Expense,
  PaymentMethodType,
  PaymentMethod,
} from "../../types/expense"
import type { Category } from "../../types/category"
import { syncDownMore } from "../../services/sync-manager"
import {
  parseExpression,
  hasOperators,
  formatAmount,
} from "../../utils/expression-parser"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { PaymentInstrumentMethod } from "../../types/payment-instrument"
import { isPaymentInstrumentMethod } from "../../services/payment-instruments"
import type { PaymentInstrument } from "../../types/payment-instrument"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "../../components/ui/PaymentInstrumentInlineDropdown"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { CategoryCard } from "../../components/ui/CategoryCard"
import { PaymentMethodCard } from "../../components/ui/PaymentMethodCard"
import { useTranslation } from "react-i18next"

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

export default function HistoryScreen() {
  const { t } = useTranslation()
  const { state, deleteExpense, editExpense, replaceAllExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const { syncConfig, settings, updateSettings } = useSettings()
  const { categories } = useCategories()
  const insets = useSafeAreaInsets()
  const [editingExpense, setEditingExpense] = React.useState<{
    id: string
    amount: string
    category: ExpenseCategory
    note: string
    date: string // ISO date string
    currency?: string
    paymentMethodType?: PaymentMethodType
    paymentMethodId: string
    paymentInstrumentId?: string
  } | null>(null)
  const [showDatePicker, setShowDatePicker] = React.useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)

  const [instrumentEntryKind, setInstrumentEntryKind] =
    React.useState<InstrumentEntryKind>("none")

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS

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
        setInstrumentEntryKind("none")
        // Deselect if already selected
        return {
          ...prev,
          paymentMethodType: undefined,
          paymentMethodId: "",
          paymentInstrumentId: undefined,
        }
      } else {
        setInstrumentEntryKind("none")
        return {
          ...prev,
          paymentMethodType: type,
          paymentMethodId: "",
          paymentInstrumentId: undefined,
        }
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
          if (
            prev.paymentMethodType &&
            isPaymentInstrumentMethod(prev.paymentMethodType)
          ) {
            setInstrumentEntryKind("manual")
          }
          return {
            ...prev,
            paymentMethodId: validateIdentifier(text, maxLen),
            paymentInstrumentId: undefined,
          }
        }
      })
    },
    [selectedPaymentConfig?.maxLength]
  )

  const groupedExpenses = React.useMemo(() => {
    // Use activeExpenses (excludes soft-deleted) for display
    // ISO timestamps sort correctly lexicographically, so avoid Date construction.
    const sorted = [...state.activeExpenses].sort((a, b) => b.date.localeCompare(a.date))

    const sections: { title: string; data: Expense[] }[] = []
    let currentIsoDate: string | null = null
    let currentSection: { title: string; data: Expense[] } | null = null

    for (const expense of sorted) {
      // Group by local day to avoid UTC offset shifts.
      // Use formatDate for section title if possible
      const dayKey = getLocalDayKey(expense.date)
      if (dayKey !== currentIsoDate) {
        currentIsoDate = dayKey
        currentSection = {
          title: formatDate(expense.date, "dd/MM/yyyy"), // Already localized in date.ts? Yes mostly
          data: [],
        }
        sections.push(currentSection)
      }
      currentSection!.data.push(expense)
    }

    return sections
  }, [state.activeExpenses])

  const categoryByLabel = React.useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) {
      map.set(category.label, category)
    }
    return map
  }, [categories])

  // Memoized handlers for list item actions
  const handleEdit = React.useCallback((expense: Expense) => {
    setInstrumentEntryKind(
      expense.paymentMethod?.instrumentId
        ? "saved"
        : expense.paymentMethod?.identifier
          ? "manual"
          : "none"
    )
    setEditingExpense({
      id: expense.id,
      amount: expense.amount.toString(),
      category: expense.category,
      note: expense.note || "",
      date: expense.date,
      currency: expense.currency,
      paymentMethodType: expense.paymentMethod?.type,
      paymentMethodId: expense.paymentMethod?.identifier || "",
      paymentInstrumentId: expense.paymentMethod?.instrumentId,
    })
  }, [])

  const handleDelete = React.useCallback((id: string) => {
    setDeletingExpenseId(id)
  }, [])

  const confirmDelete = React.useCallback(() => {
    if (deletingExpenseId) {
      deleteExpense(deletingExpenseId)
      addNotification(t("history.deleted"), "success")
      setDeletingExpenseId(null)
    }
  }, [deletingExpenseId, deleteExpense, addNotification, t])

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
      addNotification(t("history.loadError"), "error")
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, state.expenses, replaceAllExpenses, addNotification, t])

  // Memoized renderItem function
  const renderItem = React.useCallback(
    ({ item }: { item: Expense }) => {
      const categoryInfo =
        categoryByLabel.get(item.category) ??
        ({
          label: item.category,
          icon: "Circle",
          color: CATEGORY_COLORS.Other,
        } satisfies Pick<Category, "label" | "icon" | "color">)

      return (
        <ExpenseRow
          expense={item}
          categoryInfo={categoryInfo}
          subtitleMode="time"
          onEdit={handleEdit}
          onDelete={handleDelete}
          instruments={allInstruments}
          showActions
        />
      )
    },
    [handleEdit, handleDelete, allInstruments, categoryByLabel]
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
            {isLoadingMore ? t("history.loading") : t("history.loadMore")}
          </Button>
        </YStack>
      ) : null,
    [hasMore, syncConfig, handleLoadMore, isLoadingMore, t]
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
          addNotification(t("history.editDialog.fields.amountError"), "error")
          return
        }

        const result = parseExpression(editingExpense.amount)

        if (!result.success) {
          addNotification(
            result.error || t("history.editDialog.fields.expressionError"),
            "error"
          )
          return
        }

        // Build payment method object if type is selected
        const paymentMethod: PaymentMethod | undefined = editingExpense.paymentMethodType
          ? {
              type: editingExpense.paymentMethodType,
              identifier: editingExpense.paymentMethodId.trim() || undefined,
              instrumentId: editingExpense.paymentInstrumentId,
            }
          : undefined

        editExpense(editingExpense.id, {
          amount: result.value!,
          category: editingExpense.category,
          date: editingExpense.date,
          note: editingExpense.note,
          paymentMethod,
        })
        addNotification(t("history.updated"), "success")
        setEditingExpense(null)
        setShowDatePicker(false)
      }
    }
  }, [editingExpense, state.activeExpenses, editExpense, addNotification, t])

  if (state.activeExpenses.length === 0) {
    return (
      <YStack flex={1} bg="$background" style={layoutStyles.emptyContainer}>
        <Text style={layoutStyles.emptyText} color="$color" opacity={0.8}>
          {t("history.emptyTitle")}
        </Text>
        <Text style={layoutStyles.emptySubtext} color="$color" opacity={0.6}>
          {t("history.emptySubtitle")}
        </Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background" style={layoutStyles.mainContainer}>
      <H4 style={layoutStyles.header}>{t("history.title")}</H4>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingExpenseId}
        onOpenChange={(open) => !open && setDeletingExpenseId(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay key="overlay" opacity={0.5} />
          <Dialog.Content bordered elevate key="content" gap="$4">
            <Dialog.Title size="$6">{t("history.deleteDialog.title")}</Dialog.Title>
            <Dialog.Description>
              {t("history.deleteDialog.description")}
            </Dialog.Description>
            <XStack gap="$3" style={layoutStyles.dialogButtonRow}>
              <Dialog.Close asChild>
                <Button size="$4">{t("common.cancel")}</Button>
              </Dialog.Close>
              <Button size="$4" theme="red" onPress={confirmDelete}>
                {t("common.delete")}
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
            <Dialog.Title size="$6">{t("history.editDialog.title")}</Dialog.Title>
            <Dialog.Description>{t("history.editDialog.description")}</Dialog.Description>

            <KeyboardAwareScrollView
              bottomOffset={20}
              contentContainerStyle={{ paddingBottom: insets.bottom }}
            >
              <YStack gap="$3">
                <YStack gap="$2">
                  <Label color="$color" opacity={0.8} htmlFor="date">
                    {t("history.editDialog.fields.date")}
                  </Label>
                  <Button
                    size="$4"
                    onPress={() => setShowDatePicker(true)}
                    icon={Calendar}
                  >
                    {editingExpense?.date
                      ? formatDate(editingExpense.date, "dd/MM/yyyy")
                      : t("history.editDialog.fields.datePlaceholder")}
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
                      {t("common.done")}
                    </Button>
                  )}
                </YStack>

                <YStack gap="$2">
                  <Label color="$color" opacity={0.8} htmlFor="amount">
                    {t("history.editDialog.fields.amount")}
                  </Label>
                  <XStack style={{ alignItems: "center" }} gap="$2">
                    <Text fontSize="$4" fontWeight="bold" color="$color" opacity={0.8}>
                      {getCurrencySymbol(
                        editingExpense?.currency || getFallbackCurrency()
                      )}
                    </Text>
                    <Input
                      flex={1}
                      size="$4"
                      id="amount"
                      value={editingExpense?.amount || ""}
                      onChangeText={(text) =>
                        setEditingExpense((prev) =>
                          prev ? { ...prev, amount: text } : null
                        )
                      }
                      placeholder={t("history.editDialog.fields.amountPlaceholder")}
                      keyboardType="default"
                    />
                  </XStack>
                  {expressionPreview && (
                    <Text fontSize="$3" color="$color" opacity={0.7}>
                      {t("history.editDialog.fields.preview", {
                        amount: expressionPreview,
                      })}
                    </Text>
                  )}
                </YStack>

                <YStack gap="$2">
                  <Label color="$color" opacity={0.8}>
                    {t("history.editDialog.fields.category")}
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
                    {t("history.editDialog.fields.note")}
                  </Label>
                  <Input
                    id="note"
                    value={editingExpense?.note || ""}
                    onChangeText={(text) =>
                      setEditingExpense((prev) => (prev ? { ...prev, note: text } : null))
                    }
                    placeholder={t("history.editDialog.fields.notePlaceholder")}
                  />
                </YStack>

                {/* Payment Method Selection */}
                <YStack gap="$2">
                  <Label color="$color" opacity={0.8}>
                    {t("history.editDialog.fields.paymentMethod")}
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
                        {selectedPaymentConfig.identifierLabel ||
                          t("history.editDialog.fields.identifier")}
                      </Label>

                      {editingExpense?.paymentMethodType &&
                      isPaymentInstrumentMethod(editingExpense.paymentMethodType) ? (
                        <PaymentInstrumentInlineDropdown
                          method={
                            editingExpense.paymentMethodType as PaymentInstrumentMethod
                          }
                          instruments={allInstruments}
                          kind={
                            editingExpense.paymentInstrumentId
                              ? "saved"
                              : instrumentEntryKind === "manual"
                                ? "manual"
                                : "none"
                          }
                          selectedInstrumentId={editingExpense.paymentInstrumentId}
                          manualDigits={editingExpense.paymentMethodId}
                          identifierLabel={selectedPaymentConfig.identifierLabel}
                          maxLength={selectedPaymentConfig.maxLength}
                          onChange={(next) => {
                            setInstrumentEntryKind(next.kind)
                            setEditingExpense((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    paymentInstrumentId: next.selectedInstrumentId,
                                    paymentMethodId: next.manualDigits,
                                  }
                                : null
                            )
                          }}
                          onCreateInstrument={(inst) => {
                            updateSettings({
                              paymentInstruments: [inst, ...allInstruments],
                            })
                          }}
                        />
                      ) : (
                        <Input
                          size="$4"
                          placeholder={
                            editingExpense?.paymentMethodType === "Other"
                              ? t("history.editDialog.fields.otherPlaceholder")
                              : t("history.editDialog.fields.identifierPlaceholder", {
                                  max: selectedPaymentConfig.maxLength,
                                })
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
                      )}
                    </YStack>
                  )}
                </YStack>
              </YStack>

              <XStack gap="$3" style={layoutStyles.editDialogButtonRow}>
                <Dialog.Close asChild>
                  <Button size="$4">{t("common.cancel")}</Button>
                </Dialog.Close>
                <Button size="$4" themeInverse onPress={handleSaveEdit}>
                  {t("common.save")}
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
