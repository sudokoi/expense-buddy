import React, { useCallback, useMemo, useState } from "react"
import {
  YStack,
  Text,
  XStack,
  H4,
  Button,
  H6,
  Input,
  Dialog,
  Label,
  Sheet,
  ScrollView,
} from "tamagui"
import { Calendar, Filter, X } from "@tamagui/lucide-icons"
import { SectionList, Platform, ViewStyle, TextStyle, BackHandler } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DateTimePicker from "@react-native-community/datetimepicker"
import { FlashList } from "@shopify/flash-list"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useCategories,
} from "../../stores/hooks"
import { useFilters, useFilterPersistence } from "../../stores/filter-store"
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
  PAYMENT_INSTRUMENT_METHODS,
  findInstrumentById,
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
} from "../../services/payment-instruments"
import { getPaymentMethodI18nKey } from "../../constants/payment-methods"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "../../components/ui/PaymentInstrumentInlineDropdown"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { CategoryCard } from "../../components/ui/CategoryCard"
import { PaymentMethodCard } from "../../components/ui/PaymentMethodCard"
import { useTranslation } from "react-i18next"
import { TimeWindowSelector } from "../../components/analytics/TimeWindowSelector"
import { CategoryFilter } from "../../components/analytics/CategoryFilter"
import { PaymentMethodFilter } from "../../components/analytics/PaymentMethodFilter"
import { PaymentInstrumentFilter } from "../../components/analytics/PaymentInstrumentFilter"
import { AmountRangeFilter } from "../../components/analytics/AmountRangeFilter"
import { SearchFilter } from "../../components/analytics/SearchFilter"
import { CollapsibleSection } from "../../components/analytics/CollapsibleSection"
import type { TimeWindow } from "../../utils/analytics/time"
import type { PaymentMethodSelectionKey } from "../../utils/analytics/filters"
import type { PaymentInstrumentSelectionKey } from "../../utils/analytics/filters"
import { filterExpensesByTimeWindow } from "../../utils/analytics/time"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

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
    paddingVertical: 0,
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
  filterButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  } as ViewStyle,
  chipsContainer: {
    flexDirection: "row",
    marginBottom: 12,
  } as ViewStyle,
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  } as ViewStyle,
  chipText: {
    fontSize: 13,
    marginRight: 4,
  } as TextStyle,
  sheetFrame: {
    padding: 16,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  contentContainer: {
    marginTop: 8,
  } as ViewStyle,
}

// Filter chip component
const FilterChip = React.memo(function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <Button
      size="$2"
      bordered
      onPress={onRemove}
      style={{ borderRadius: 999 }}
      iconAfter={X}
    >
      <Button.Text numberOfLines={1}>{label}</Button.Text>
    </Button>
  )
})

const INSTRUMENT_OTHERS_ID = "__others__"

function methodShortLabel(method: string): string {
  switch (method) {
    case "Credit Card":
      return "CC"
    case "Debit Card":
      return "DC"
    case "UPI":
      return "UPI"
    default:
      return method
  }
}

export default function HistoryScreen() {
  const { t } = useTranslation()
  const { state, deleteExpense, editExpense, replaceAllExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const { syncConfig, settings, updateSettings } = useSettings()
  const { categories } = useCategories()
  const insets = useSafeAreaInsets()

  // Filter state from store
  const {
    filters,
    activeCount,
    hasActive,
    isHydrated,
    setTimeWindow,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSearchQuery,
    setAmountRange,
    reset,
  } = useFilters()

  // Filter persistence
  const { save: saveFilters } = useFilterPersistence()

  // Local UI state
  const [editingExpense, setEditingExpense] = useState<{
    id: string
    amount: string
    category: ExpenseCategory
    note: string
    date: string
    currency?: string
    paymentMethodType?: PaymentMethodType
    paymentMethodId: string
    paymentInstrumentId?: string
  } | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [instrumentEntryKind, setInstrumentEntryKind] =
    useState<InstrumentEntryKind>("none")

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS

  // Handle back button to close dialogs instead of navigating
  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editingExpense) {
        setEditingExpense(null)
        setShowDatePicker(false)
        return true
      }
      if (deletingExpenseId) {
        setDeletingExpenseId(null)
        return true
      }
      if (showFilterSheet) {
        setShowFilterSheet(false)
        return true
      }
      return false
    })

    return () => backHandler.remove()
  }, [editingExpense, deletingExpenseId, showFilterSheet])

  // Compute preview when expression contains operators
  const expressionPreview = useMemo(() => {
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
  const selectedPaymentConfig = useMemo(() => {
    if (!editingExpense?.paymentMethodType) return null
    return (
      PAYMENT_METHODS.find((pm) => pm.value === editingExpense.paymentMethodType) || null
    )
  }, [editingExpense?.paymentMethodType])

  // Apply filters to expenses
  const filteredExpenses = useMemo(() => {
    let result = [...state.activeExpenses]

    // Apply time window filter
    result = filterExpensesByTimeWindow(result, filters.timeWindow)

    // Apply category filter
    if (filters.selectedCategories.length > 0) {
      result = result.filter((e) => filters.selectedCategories.includes(e.category))
    }

    // Apply payment method filter
    if (filters.selectedPaymentMethods.length > 0) {
      result = result.filter((e) => {
        if (!e.paymentMethod) return filters.selectedPaymentMethods.includes("__none__")
        return filters.selectedPaymentMethods.includes(e.paymentMethod.type)
      })
    }

    // Apply payment instrument filter
    if (filters.selectedPaymentInstruments.length > 0) {
      result = result.filter((e) => {
        if (!e.paymentMethod?.instrumentId) return false
        const key = `${e.paymentMethod.type}::${e.paymentMethod.instrumentId}`
        return filters.selectedPaymentInstruments.includes(key)
      })
    }

    // Apply search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      result = result.filter(
        (e) =>
          e.category.toLowerCase().includes(query) ||
          (e.note && e.note.toLowerCase().includes(query)) ||
          e.amount.toString().includes(query)
      )
    }

    // Apply amount range filter
    if (filters.minAmount !== null) {
      result = result.filter((e) => e.amount >= filters.minAmount!)
    }
    if (filters.maxAmount !== null) {
      result = result.filter((e) => e.amount <= filters.maxAmount!)
    }

    return result
  }, [state.activeExpenses, filters])

  // Group filtered expenses by date
  const groupedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date))

    const sections: { title: string; data: Expense[] }[] = []
    let currentIsoDate: string | null = null
    let currentSection: { title: string; data: Expense[] } | null = null

    for (const expense of sorted) {
      const dayKey = getLocalDayKey(expense.date)
      if (dayKey !== currentIsoDate) {
        currentIsoDate = dayKey
        currentSection = {
          title: formatDate(expense.date, "dd/MM/yyyy"),
          data: [],
        }
        sections.push(currentSection)
      }
      currentSection!.data.push(expense)
    }

    return sections
  }, [filteredExpenses])

  // Flatten for FlashList
  const flattenedExpenses = useMemo(() => {
    const items: Array<
      | { type: "header"; title: string; id: string }
      | { type: "expense"; expense: Expense; id: string }
    > = []

    for (const section of groupedExpenses) {
      items.push({ type: "header", title: section.title, id: `header-${section.title}` })
      for (const expense of section.data) {
        items.push({ type: "expense", expense, id: expense.id })
      }
    }

    return items
  }, [groupedExpenses])

  const categoryByLabel = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) {
      map.set(category.label, category)
    }
    return map
  }, [categories])

  // Helper functions for filter chips (matching analytics tab)
  const formatListBreakdown = useCallback(
    (items: string[]): string => {
      const MAX_ITEMS = 3

      const unique = Array.from(new Set(items)).sort((a, b) => a.localeCompare(b))
      const visible = unique.slice(0, MAX_ITEMS)
      const remaining = unique.length - visible.length

      if (unique.length === 0) return t("analytics.timeWindow.all")
      if (unique.length === 1) return unique[0]

      return remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")
    },
    [t]
  )

  const paymentMethodLabel = useCallback(
    (key: PaymentMethodSelectionKey): string => {
      if (key === "__none__") return t("analytics.chart.none")
      return t(`paymentMethods.${getPaymentMethodI18nKey(key as PaymentMethodType)}`)
    },
    [t]
  )

  const formatSelectedPaymentInstrumentLabel = useCallback(
    (key: PaymentInstrumentSelectionKey, instruments: PaymentInstrument[]): string => {
      const [method, instrumentId] = key.split("::")
      const shortMethod = methodShortLabel(method)

      if (!instrumentId || instrumentId === INSTRUMENT_OTHERS_ID) {
        return `${shortMethod} • ${t("analytics.chart.others")}`
      }

      const inst = findInstrumentById(instruments, instrumentId)
      if (!inst || inst.deletedAt) {
        return `${shortMethod} • ${t("analytics.chart.others")}`
      }

      return `${shortMethod} • ${formatPaymentInstrumentLabel(inst)}`
    },
    [t]
  )

  const formatSelectedPaymentInstrumentsSummary = useCallback(
    (keys: PaymentInstrumentSelectionKey[]): string => {
      if (keys.length === 0) return t("analytics.timeWindow.all")
      if (keys.length === 1) return "1"

      const countsByMethod = new Map<string, number>()
      for (const key of keys) {
        const [method] = key.split("::")
        const short = methodShortLabel(method)
        countsByMethod.set(short, (countsByMethod.get(short) ?? 0) + 1)
      }

      const parts = Array.from(countsByMethod.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([method, count]) => `${method} ${count}`)

      const MAX_GROUPS = 3
      const visible = parts.slice(0, MAX_GROUPS)
      const remaining = parts.length - visible.length
      const breakdown =
        remaining > 0 ? `${visible.join(", ")}, +${remaining}` : visible.join(", ")

      return `${keys.length} (${breakdown})`
    },
    [t]
  )

  // Check if payment instrument filter should be shown
  const showPaymentInstrumentFilter = useMemo(() => {
    const active = getActivePaymentInstruments(allInstruments)
    const allowedMethods =
      filters.selectedPaymentMethods.length === 0
        ? new Set(PAYMENT_INSTRUMENT_METHODS)
        : new Set(
            PAYMENT_INSTRUMENT_METHODS.filter((m) =>
              filters.selectedPaymentMethods.includes(m as PaymentMethodSelectionKey)
            )
          )

    for (const method of PAYMENT_INSTRUMENT_METHODS) {
      if (!allowedMethods.has(method)) continue
      if (active.some((i) => i.method === method)) return true
    }
    return false
  }, [allInstruments, filters.selectedPaymentMethods])

  // Generate filter chips (matching analytics tab style)
  const filterChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = []

    // Time chip - always show
    chips.push({
      label: t("analytics.filters.time", {
        window: t(`analytics.timeWindow.${filters.timeWindow}`),
      }),
      onRemove: () => setTimeWindow("all"),
    })

    // Category chip - always show
    if (filters.selectedCategories.length === 0) {
      chips.push({
        label: t("analytics.filters.category", {
          category: t("analytics.timeWindow.all"),
        }),
        onRemove: () => setSelectedCategories([]),
      })
    } else if (filters.selectedCategories.length === 1) {
      chips.push({
        label: t("analytics.filters.category", {
          category: filters.selectedCategories[0],
        }),
        onRemove: () => setSelectedCategories([]),
      })
    } else {
      chips.push({
        label: t("analytics.filters.category", {
          category: `${filters.selectedCategories.length} (${formatListBreakdown(filters.selectedCategories)})`,
        }),
        onRemove: () => setSelectedCategories([]),
      })
    }

    // Payment method chip - always show
    if (filters.selectedPaymentMethods.length === 0) {
      chips.push({
        label: t("analytics.filters.payment", {
          method: t("analytics.timeWindow.all"),
        }),
        onRemove: () => setSelectedPaymentMethods([]),
      })
    } else if (filters.selectedPaymentMethods.length === 1) {
      const only = filters.selectedPaymentMethods[0]
      chips.push({
        label: t("analytics.filters.payment", {
          method: paymentMethodLabel(only),
        }),
        onRemove: () => setSelectedPaymentMethods([]),
      })
    } else {
      chips.push({
        label: t("analytics.filters.payment", {
          method: `${filters.selectedPaymentMethods.length} (${formatListBreakdown(filters.selectedPaymentMethods.map(paymentMethodLabel))})`,
        }),
        onRemove: () => setSelectedPaymentMethods([]),
      })
    }

    // Payment instrument chip - only show when applicable
    if (showPaymentInstrumentFilter) {
      if (filters.selectedPaymentInstruments.length === 0) {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: t("analytics.timeWindow.all"),
          }),
          onRemove: () => setSelectedPaymentInstruments([]),
        })
      } else if (filters.selectedPaymentInstruments.length === 1) {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentLabel(
              filters.selectedPaymentInstruments[0],
              allInstruments
            ),
          }),
          onRemove: () => setSelectedPaymentInstruments([]),
        })
      } else {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentsSummary(
              filters.selectedPaymentInstruments
            ),
          }),
          onRemove: () => setSelectedPaymentInstruments([]),
        })
      }
    }

    return chips
  }, [
    filters,
    t,
    setTimeWindow,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    formatListBreakdown,
    paymentMethodLabel,
    formatSelectedPaymentInstrumentLabel,
    formatSelectedPaymentInstrumentsSummary,
    showPaymentInstrumentFilter,
    allInstruments,
  ])

  // Memoized handlers for list item actions
  const handleEdit = useCallback((expense: Expense) => {
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

  const handleDelete = useCallback((id: string) => {
    setDeletingExpenseId(id)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deletingExpenseId) {
      deleteExpense(deletingExpenseId)
      addNotification(t("history.deleted"), "success")
      setDeletingExpenseId(null)
    }
  }, [deletingExpenseId, deleteExpense, addNotification, t])

  const handleLoadMore = useCallback(async () => {
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

  // Render item for FlashList
  const renderFlashListItem = useCallback(
    ({
      item,
    }: {
      item:
        | { type: "header"; title: string; id: string }
        | { type: "expense"; expense: Expense; id: string }
    }) => {
      if (item.type === "header") {
        return (
          <YStack background="$background" style={layoutStyles.sectionHeader}>
            <H6 color="$color" opacity={0.8}>
              {item.title}
            </H6>
          </YStack>
        )
      }

      const categoryInfo =
        categoryByLabel.get(item.expense.category) ??
        ({
          label: item.expense.category,
          icon: "Circle",
          color: CATEGORY_COLORS.Other,
        } satisfies Pick<Category, "label" | "icon" | "color">)

      return (
        <ExpenseRow
          expense={item.expense}
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

  // Render item for SectionList
  const renderItem = useCallback(
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

  // Render section header for SectionList
  const renderSectionHeader = useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <YStack background="$background" style={layoutStyles.sectionHeader}>
        <H6 color="$color" opacity={0.8}>
          {title}
        </H6>
      </YStack>
    ),
    []
  )

  // Key extractors
  const keyExtractor = useCallback((item: Expense) => item.id, [])
  const flashListKeyExtractor = useCallback(
    (item: { type: "header" | "expense"; id: string }) => item.id,
    []
  )

  // List footer component
  const ListFooterComponent = useMemo(
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

  // Content container style
  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: insets.bottom }),
    [insets.bottom]
  )

  // Save handler for edit dialog
  const handleSaveEdit = useCallback(() => {
    if (editingExpense) {
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

  // Filter sheet handlers
  const handleOpenFilterSheet = useCallback(() => {
    setShowFilterSheet(true)
  }, [])

  const handleCloseFilterSheet = useCallback(() => {
    setShowFilterSheet(false)
    saveFilters()
  }, [saveFilters])

  const handleResetFilters = useCallback(() => {
    reset()
  }, [reset])

  // Category selection handler for edit dialog
  const handleCategorySelect = useCallback((category: ExpenseCategory) => {
    setEditingExpense((prev) => (prev ? { ...prev, category } : null))
  }, [])

  const handlePaymentMethodSelect = useCallback((type: PaymentMethodType) => {
    setEditingExpense((prev) => {
      if (!prev) return null
      if (prev.paymentMethodType === type) {
        setInstrumentEntryKind("none")
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

  const handleIdentifierChange = useCallback(
    (text: string) => {
      setEditingExpense((prev) => {
        if (!prev) return null
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

  // Determine if we should use FlashList
  const useFlashList = filteredExpenses.length > 100

  // Empty state
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

  // Filtered empty state
  if (filteredExpenses.length === 0 && hasActive) {
    return (
      <YStack flex={1} bg="$background" style={layoutStyles.mainContainer}>
        <H4 style={layoutStyles.header}>{t("history.title")}</H4>

        {/* Filter Button */}
        <XStack style={layoutStyles.filterButtonContainer}>
          <Button
            size="$3"
            icon={Filter}
            onPress={handleOpenFilterSheet}
            themeInverse={activeCount > 0}
          >
            {t("common.filters")}
            {activeCount > 0 && (
              <Text fontSize="$2" fontWeight="bold" style={{ marginLeft: 4 }}>
                ({activeCount})
              </Text>
            )}
          </Button>
        </XStack>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 } as any}
        >
          {filterChips.map((chip, index) => (
            <FilterChip key={index} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </ScrollView>

        <YStack flex={1} style={layoutStyles.emptyContainer}>
          <Text style={layoutStyles.emptyText} color="$color" opacity={0.8}>
            {t("history.noResultsTitle")}
          </Text>
          <Text style={layoutStyles.emptySubtext} color="$color" opacity={0.6}>
            {t("history.noResultsSubtitle")}
          </Text>
          <Button size="$4" onPress={handleResetFilters} style={{ marginTop: 16 }}>
            {t("common.clearFilters")}
          </Button>
        </YStack>

        {/* Filter Sheet */}
        <FilterSheet
          open={showFilterSheet}
          onClose={handleCloseFilterSheet}
          filters={filters}
          isHydrated={isHydrated}
          allInstruments={allInstruments}
          categories={categories}
          onTimeWindowChange={setTimeWindow}
          onCategoriesChange={setSelectedCategories}
          onPaymentMethodsChange={setSelectedPaymentMethods}
          onPaymentInstrumentsChange={setSelectedPaymentInstruments}
          onSearchChange={setSearchQuery}
          onAmountRangeChange={setAmountRange}
          _onReset={handleResetFilters}
        />
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background" style={layoutStyles.mainContainer}>
      <H4 style={layoutStyles.header}>{t("history.title")}</H4>

      {/* Filter Button */}
      <XStack style={layoutStyles.filterButtonContainer}>
        <Button
          size="$3"
          icon={Filter}
          onPress={handleOpenFilterSheet}
          themeInverse={activeCount > 0}
        >
          {t("common.filters")}
          {activeCount > 0 && (
            <Text fontSize="$2" fontWeight="bold" style={{ marginLeft: 4 }}>
              ({activeCount})
            </Text>
          )}
        </Button>
      </XStack>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 } as any}
      >
        {filterChips.map((chip, index) => (
          <FilterChip key={index} label={chip.label} onRemove={chip.onRemove} />
        ))}
      </ScrollView>

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
            style={{ maxHeight: "80%" }}
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

      {/* Filter Sheet */}
      <FilterSheet
        open={showFilterSheet}
        onClose={handleCloseFilterSheet}
        filters={filters}
        isHydrated={isHydrated}
        allInstruments={allInstruments}
        categories={categories}
        onTimeWindowChange={setTimeWindow}
        onCategoriesChange={setSelectedCategories}
        onPaymentMethodsChange={setSelectedPaymentMethods}
        onPaymentInstrumentsChange={setSelectedPaymentInstruments}
        onSearchChange={setSearchQuery}
        onAmountRangeChange={setAmountRange}
        _onReset={handleResetFilters}
      />

      {/* List - FlashList for large datasets, SectionList for smaller ones */}
      {useFlashList ? (
        <FlashList
          data={flattenedExpenses}
          renderItem={renderFlashListItem}
          keyExtractor={flashListKeyExtractor}
          // Note: FlashList doesn't have estimatedItemSize prop, using getItemType instead
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={ListFooterComponent}
        />
      ) : (
        <SectionList
          sections={groupedExpenses}
          keyExtractor={keyExtractor}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={ListFooterComponent}
        />
      )}
    </YStack>
  )
}

// Filter Sheet Component
interface FilterSheetProps {
  open: boolean
  onClose: () => void
  filters: {
    timeWindow: TimeWindow
    selectedCategories: string[]
    selectedPaymentMethods: PaymentMethodSelectionKey[]
    selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
    searchQuery: string
    minAmount: number | null
    maxAmount: number | null
  }
  isHydrated: boolean
  allInstruments: PaymentInstrument[]
  categories: Category[]
  onTimeWindowChange: (window: TimeWindow) => void
  onCategoriesChange: (categories: string[]) => void
  onPaymentMethodsChange: (methods: PaymentMethodSelectionKey[]) => void
  onPaymentInstrumentsChange: (instruments: PaymentInstrumentSelectionKey[]) => void
  onSearchChange: (query: string) => void
  onAmountRangeChange: (min: number | null, max: number | null) => void
  _onReset: () => void
}

const FilterSheet = React.memo(function FilterSheet({
  open,
  onClose,
  filters,
  isHydrated,
  allInstruments,
  onTimeWindowChange,
  onCategoriesChange,
  onPaymentMethodsChange,
  onPaymentInstrumentsChange,
  onSearchChange,
  onAmountRangeChange,
  _onReset,
}: FilterSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  // Local draft state
  const [draftTimeWindow, setDraftTimeWindow] = useState<TimeWindow>(filters.timeWindow)
  const [draftCategories, setDraftCategories] = useState<string[]>(
    filters.selectedCategories
  )
  const [draftPaymentMethods, setDraftPaymentMethods] = useState<
    PaymentMethodSelectionKey[]
  >(filters.selectedPaymentMethods)
  const [draftPaymentInstruments, setDraftPaymentInstruments] = useState<
    PaymentInstrumentSelectionKey[]
  >(filters.selectedPaymentInstruments)
  const [draftSearchQuery, setDraftSearchQuery] = useState(filters.searchQuery)
  const [draftMinAmount, setDraftMinAmount] = useState<number | null>(filters.minAmount)
  const [draftMaxAmount, setDraftMaxAmount] = useState<number | null>(filters.maxAmount)

  // Sync draft with props when opening
  React.useEffect(() => {
    if (open) {
      setDraftTimeWindow(filters.timeWindow)
      setDraftCategories(filters.selectedCategories)
      setDraftPaymentMethods(filters.selectedPaymentMethods)
      setDraftPaymentInstruments(filters.selectedPaymentInstruments)
      setDraftSearchQuery(filters.searchQuery)
      setDraftMinAmount(filters.minAmount)
      setDraftMaxAmount(filters.maxAmount)
    }
  }, [open, filters])

  // Check if payment instrument filter should be shown
  const showPaymentInstrumentFilter = useMemo(() => {
    const active = getActivePaymentInstruments(allInstruments)
    const allowedMethods =
      draftPaymentMethods.length === 0
        ? new Set(PAYMENT_INSTRUMENT_METHODS)
        : new Set(
            PAYMENT_INSTRUMENT_METHODS.filter((m) =>
              draftPaymentMethods.includes(m as PaymentMethodSelectionKey)
            )
          )

    for (const method of PAYMENT_INSTRUMENT_METHODS) {
      if (!allowedMethods.has(method)) continue
      if (active.some((i) => i.method === method)) return true
    }
    return false
  }, [allInstruments, draftPaymentMethods])

  // Prune instrument selection when payment methods change
  const prunePaymentInstrumentSelection = useCallback(
    (
      nextSelectedPaymentMethods: PaymentMethodSelectionKey[],
      currentInstrumentSelection: PaymentInstrumentSelectionKey[]
    ): PaymentInstrumentSelectionKey[] => {
      if (currentInstrumentSelection.length === 0) return currentInstrumentSelection

      const active = getActivePaymentInstruments(allInstruments)
      const allowedMethods =
        nextSelectedPaymentMethods.length === 0
          ? new Set(PAYMENT_INSTRUMENT_METHODS)
          : new Set(
              PAYMENT_INSTRUMENT_METHODS.filter((m) =>
                nextSelectedPaymentMethods.includes(m as PaymentMethodSelectionKey)
              )
            )

      const allowedWithConfig = new Set<string>()
      for (const method of allowedMethods) {
        if (active.some((i) => i.method === method)) {
          allowedWithConfig.add(method)
        }
      }

      return currentInstrumentSelection.filter((key) => {
        const method = key.split("::")[0]
        return allowedWithConfig.has(method)
      })
    },
    [allInstruments]
  )

  const handlePaymentMethodsChange = useCallback(
    (next: PaymentMethodSelectionKey[]) => {
      setDraftPaymentMethods(next)
      setDraftPaymentInstruments((prev) => {
        if (next.length === 0) return []
        return prunePaymentInstrumentSelection(next, prev)
      })
    },
    [prunePaymentInstrumentSelection]
  )

  const handleApply = useCallback(() => {
    onTimeWindowChange(draftTimeWindow)
    onCategoriesChange(draftCategories)
    onPaymentMethodsChange(draftPaymentMethods)
    onPaymentInstrumentsChange(draftPaymentInstruments)
    onSearchChange(draftSearchQuery)
    onAmountRangeChange(draftMinAmount, draftMaxAmount)
    onClose()
  }, [
    draftTimeWindow,
    draftCategories,
    draftPaymentMethods,
    draftPaymentInstruments,
    draftSearchQuery,
    draftMinAmount,
    draftMaxAmount,
    onTimeWindowChange,
    onCategoriesChange,
    onPaymentMethodsChange,
    onPaymentInstrumentsChange,
    onSearchChange,
    onAmountRangeChange,
    onClose,
  ])

  const handleResetDraft = useCallback(() => {
    setDraftTimeWindow("all")
    setDraftCategories([])
    setDraftPaymentMethods([])
    setDraftPaymentInstruments([])
    setDraftSearchQuery("")
    setDraftMinAmount(null)
    setDraftMaxAmount(null)
  }, [])

  if (!open) return null

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) handleApply()
      }}
      snapPoints={[90]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack
          gap="$3"
          style={{ ...layoutStyles.contentContainer, flex: 1 } as ViewStyle}
        >
          <XStack style={layoutStyles.headerRow}>
            <H4>{t("history.filterSheet.title")}</H4>
            <XStack gap="$2" style={{ alignItems: "center" } as ViewStyle}>
              <Button size="$3" chromeless onPress={handleResetDraft}>
                {t("common.reset")}
              </Button>
              <Button
                size="$3"
                chromeless
                icon={X}
                onPress={handleApply}
                aria-label={t("common.close")}
              />
            </XStack>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false} flex={1}>
            <YStack gap="$2" pb="$6">
              {!isHydrated && (
                <Text color="$color" opacity={0.6} fontSize="$3">
                  {t("history.filterSheet.loading")}
                </Text>
              )}

              <CollapsibleSection title={t("history.filterSheet.time")}>
                <TimeWindowSelector
                  value={draftTimeWindow}
                  onChange={setDraftTimeWindow}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.search")}>
                <SearchFilter value={draftSearchQuery} onChange={setDraftSearchQuery} />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.amountRange")}>
                <AmountRangeFilter
                  minAmount={draftMinAmount}
                  maxAmount={draftMaxAmount}
                  onChange={(min, max) => {
                    setDraftMinAmount(min)
                    setDraftMaxAmount(max)
                  }}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.category")}>
                <CategoryFilter
                  selectedCategories={draftCategories}
                  onChange={setDraftCategories}
                />
              </CollapsibleSection>

              <CollapsibleSection title={t("history.filterSheet.paymentMethod")}>
                <PaymentMethodFilter
                  selected={draftPaymentMethods}
                  onChange={handlePaymentMethodsChange}
                />
              </CollapsibleSection>

              {showPaymentInstrumentFilter && (
                <CollapsibleSection title={t("history.filterSheet.paymentInstrument")}>
                  <PaymentInstrumentFilter
                    instruments={allInstruments}
                    selectedPaymentMethods={draftPaymentMethods}
                    selected={draftPaymentInstruments}
                    onChange={setDraftPaymentInstruments}
                  />
                </CollapsibleSection>
              )}
            </YStack>
          </ScrollView>

          <XStack
            gap="$2"
            style={
              {
                justifyContent: "flex-end",
                paddingBottom: Math.max(insets.bottom, 8),
                paddingTop: 8,
              } as ViewStyle
            }
          >
            <Button size="$4" themeInverse onPress={handleApply}>
              {t("common.apply")}
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
})
