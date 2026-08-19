import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react"
import { Text, View, ScrollView, Modal } from "react-native"
import { Filter, X } from "lucide-react-native"
import { BackHandler } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FlashList } from "@shopify/flash-list"
import { useRouter, Href } from "expo-router"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useCategories,
  useDerivedExpenseData,
} from "../../stores/hooks"
import { logAsync } from "../../services/logger"
import { useFilters, useFilterPersistence } from "../../stores/filter-store"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import { getLocalDayKey, formatDate } from "../../utils/date"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import { syncDownMore } from "../../services/sync-manager"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { Button } from "../../components/ui/Button"
import { useTranslation } from "react-i18next"
import {
  formatListBreakdown,
  paymentMethodLabel,
  formatSelectedPaymentInstrumentLabel,
  formatSelectedPaymentInstrumentsSummary,
  showPaymentInstrumentFilter as computeShowPaymentInstrumentFilter,
} from "../../utils/analytics/filter-summary"
import { applyAllFilters } from "../../utils/analytics/filters"
import { getCurrencySymbol } from "../../utils/currency"
import { formatMonthLabel, isTimeWindowCovered } from "../../utils/analytics/time"
import { UI_SPACE, UI_OPACITY } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { hapticWarning } from "../../utils/haptics"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

const FALLBACK_CATEGORY_CACHE = new Map<
  string,
  Pick<Category, "label" | "icon" | "color">
>()

function getFallbackCategory(label: string): Pick<Category, "label" | "icon" | "color"> {
  let info = FALLBACK_CATEGORY_CACHE.get(label)
  if (!info) {
    info = { label, icon: "Circle", color: CATEGORY_COLORS.Other }
    FALLBACK_CATEGORY_CACHE.set(label, info)
  }
  return info
}

const layoutStyles = {
  emptyText: {
    fontSize: 18,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: UI_SPACE.control,
  },
  expenseDetails: {
    alignItems: "center",
  },
  actionButtons: {
    alignItems: "center",
  },
  chipsContainer: {
    flexDirection: "row",
    marginBottom: UI_SPACE.section,
  },
  sheetFrame: {
    padding: UI_SPACE.gutter,
  },
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  contentContainer: {
    marginTop: UI_SPACE.control,
  },
} as const

// Filter chip component
const FilterChip = React.memo(function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  const theme = useThemeColors()
  return (
    <Button
      size="chip"
      variant="outline"
      className="gap-1"
      onPress={() => {
        logAsync("INFO", "UI_ACTION", "REMOVE_FILTER_CHIP")
        onRemove()
      }}
    >
      <Text numberOfLines={1}>{label}</Text>
      <X size={14} color={theme.foreground} />
    </Button>
  )
})

export default function HistoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useThemeColors()
  const { state, deleteExpense, replaceAllExpenses } = useExpenses()
  const { addNotification } = useNotifications()
  const { syncConfig, settings } = useSettings()
  const { categories } = useCategories()
  const insets = useSafeAreaInsets()

  // Filter state from shared store (single source of truth for all tabs)
  const {
    filters,
    activeCount,
    hasActive,
    setTimeWindow,
    setSelectedMonth,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSelectedCurrency,
    applyFilters,
  } = useFilters()

  // Initialize filter persistence (loads persisted filters from storage on mount)
  const { save: saveFilters } = useFilterPersistence()

  // Local UI state
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS

  // Pre-computed derived data (shared across tabs — single-pass derivation,
  // avoids redundant expense iterations on each screen mount)
  const {
    availableCurrencies,
    availableMonths,
    currencyExpenses,
    effectiveCurrency,
    effectiveSelectedMonth,
  } = useDerivedExpenseData()

  // Defer the filters object so the expensive computation chain (filter → sort →
  // group → flatten) runs as a low-priority background render. The filter chips
  // and controls use `filters` directly (instant updates), while the list uses
  // `deferredFilters` (may lag one frame behind but keeps the UI responsive).
  const deferredFilters = useDeferredValue(filters)
  const isFilterStale = deferredFilters !== filters

  // Handle back button to close the delete dialog instead of navigating
  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (deletingExpenseId) {
        setDeletingExpenseId(null)
        return true
      }
      return false
    })

    return () => backHandler.remove()
  }, [deletingExpenseId])

  // === Expensive computation chain (uses deferredFilters for concurrent rendering) ===

  // Apply all filters in single pass. Month resolution is done inline using the
  // same deferred timestamp as other filter values — this avoids temporal
  // inconsistency between month and other filter fields.
  const filteredExpenses = useMemo(() => {
    const resolvedFilters = {
      ...deferredFilters,
      selectedMonth:
        deferredFilters.selectedMonth &&
        availableMonths.includes(deferredFilters.selectedMonth)
          ? deferredFilters.selectedMonth
          : null,
    }
    return applyAllFilters(currencyExpenses, resolvedFilters, allInstruments)
  }, [currencyExpenses, deferredFilters, allInstruments, availableMonths])

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

  const shouldShowLoadMore = useMemo(() => {
    if (!hasMore || !syncConfig || deferredFilters.selectedMonth) return false

    return !isTimeWindowCovered(state.expenses, deferredFilters.timeWindow)
  }, [
    deferredFilters.selectedMonth,
    deferredFilters.timeWindow,
    hasMore,
    syncConfig,
    state.expenses,
  ])

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

  // === End expensive chain ===

  const categoryByLabel = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) {
      map.set(category.label, category)
    }
    return map
  }, [categories])

  // Helper functions for filter chips (matching analytics tab)
  const showPaymentInstrumentFilter = useMemo(
    () =>
      computeShowPaymentInstrumentFilter(allInstruments, filters.selectedPaymentMethods),
    [allInstruments, filters.selectedPaymentMethods]
  )

  // Generate filter chips (uses `filters` directly for instant chip label updates,
  // but uses effectiveSelectedMonth to avoid showing a stale month chip when the
  // stored month doesn't exist for the current currency)
  const filterChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = []

    // Time chip - always show
    if (effectiveSelectedMonth) {
      chips.push({
        label: t("analytics.filters.month", {
          month: formatMonthLabel(effectiveSelectedMonth),
        }),
        onRemove: () => startTransition(() => setSelectedMonth(null)),
      })
    } else {
      chips.push({
        label: t("analytics.filters.time", {
          window: t(`analytics.timeWindow.${filters.timeWindow}`),
        }),
        onRemove: () => startTransition(() => setTimeWindow("all")),
      })
    }

    // Currency chip - only relevant when more than one currency exists.
    // Clearing reverts to the default currency everywhere (shared store) and
    // persists so the reset sticks across the app.
    if (availableCurrencies.length > 1) {
      chips.push({
        label: `${t("settings.localization.currency")}: ${effectiveCurrency} (${getCurrencySymbol(effectiveCurrency)})`,
        onRemove: () => {
          startTransition(() => setSelectedCurrency(null))
          void saveFilters().catch((error) =>
            console.warn("Failed to persist currency selection:", error)
          )
        },
      })
    }

    // Category chip - always show
    if (filters.selectedCategories.length === 0) {
      chips.push({
        label: t("analytics.filters.category", {
          category: t("analytics.timeWindow.all"),
        }),
        onRemove: () => startTransition(() => setSelectedCategories([])),
      })
    } else if (filters.selectedCategories.length === 1) {
      chips.push({
        label: t("analytics.filters.category", {
          category: filters.selectedCategories[0],
        }),
        onRemove: () => startTransition(() => setSelectedCategories([])),
      })
    } else {
      chips.push({
        label: t("analytics.filters.category", {
          category: `${filters.selectedCategories.length} (${formatListBreakdown(filters.selectedCategories, t("analytics.timeWindow.all"))})`,
        }),
        onRemove: () => startTransition(() => setSelectedCategories([])),
      })
    }

    // Payment method chip - always show
    if (filters.selectedPaymentMethods.length === 0) {
      chips.push({
        label: t("analytics.filters.payment", {
          method: t("analytics.timeWindow.all"),
        }),
        onRemove: () => startTransition(() => setSelectedPaymentMethods([])),
      })
    } else if (filters.selectedPaymentMethods.length === 1) {
      const only = filters.selectedPaymentMethods[0]
      chips.push({
        label: t("analytics.filters.payment", {
          method: paymentMethodLabel(only, t),
        }),
        onRemove: () => startTransition(() => setSelectedPaymentMethods([])),
      })
    } else {
      chips.push({
        label: t("analytics.filters.payment", {
          method: `${filters.selectedPaymentMethods.length} (${formatListBreakdown(
            filters.selectedPaymentMethods.map((m) => paymentMethodLabel(m, t)),
            t("analytics.timeWindow.all")
          )})`,
        }),
        onRemove: () => startTransition(() => setSelectedPaymentMethods([])),
      })
    }

    // Payment instrument chip - only show when applicable
    if (showPaymentInstrumentFilter) {
      if (filters.selectedPaymentInstruments.length === 0) {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: t("analytics.timeWindow.all"),
          }),
          onRemove: () => startTransition(() => setSelectedPaymentInstruments([])),
        })
      } else if (filters.selectedPaymentInstruments.length === 1) {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentLabel(
              filters.selectedPaymentInstruments[0],
              allInstruments,
              t
            ),
          }),
          onRemove: () => startTransition(() => setSelectedPaymentInstruments([])),
        })
      } else {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentsSummary(
              filters.selectedPaymentInstruments,
              t
            ),
          }),
          onRemove: () => startTransition(() => setSelectedPaymentInstruments([])),
        })
      }
    }

    return chips
  }, [
    filters,
    effectiveSelectedMonth,
    t,
    setTimeWindow,
    setSelectedMonth,
    setSelectedCategories,
    setSelectedPaymentMethods,
    setSelectedPaymentInstruments,
    setSelectedCurrency,
    saveFilters,
    availableCurrencies,
    effectiveCurrency,
    showPaymentInstrumentFilter,
    allInstruments,
  ])

  // Memoized handlers for list item actions
  const handleEdit = useCallback(
    (expense: Expense) => {
      router.push(`/history/edit/${expense.id}` as Href)
    },
    [router]
  )

  const handleDelete = useCallback((id: string) => {
    setDeletingExpenseId(id)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deletingExpenseId) {
      deleteExpense(deletingExpenseId)
      void hapticWarning()
      addNotification(t("history.deleted"), "success")
      logAsync("INFO", "UI_ACTION", `DELETE_EXPENSE id=${deletingExpenseId}`)
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
          <View className="bg-background py-2">
            <Text
              className="text-base font-semibold text-foreground"
              style={{ opacity: UI_OPACITY.strong }}
            >
              {item.title}
            </Text>
          </View>
        )
      }

      const categoryInfo =
        categoryByLabel.get(item.expense.category) ??
        getFallbackCategory(item.expense.category)

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

  // Key extractor for FlashList
  const keyExtractor = useCallback(
    (item: { type: "header" | "expense"; id: string }) => item.id,
    []
  )

  // Get item type for FlashList to optimize recycling
  const getItemType = useCallback((item: { type: "header" | "expense" }) => item.type, [])

  // Override item layout for different item types (headers are smaller than expenses)
  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, item: { type: "header" | "expense" }) => {
      layout.size = item.type === "header" ? 32 : 90
    },
    []
  )

  // List footer component
  const ListFooterComponent = useMemo(
    () =>
      shouldShowLoadMore ? (
        <View className="items-center p-4">
          <Button
            size="control"
            variant="accent"
            onPress={handleLoadMore}
            disabled={isLoadingMore}
            accessibilityLabel={t("history.loadMore")}
          >
            {isLoadingMore ? t("history.loading") : t("history.loadMore")}
          </Button>
        </View>
      ) : null,
    [handleLoadMore, isLoadingMore, shouldShowLoadMore, t]
  )

  // Content container style
  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: insets.bottom }),
    [insets.bottom]
  )

  // Open the shared filters screen
  const handleOpenFilterSheet = useCallback(() => {
    router.push("/filters" as Href)
  }, [router])

  const handleResetFilters = useCallback(() => {
    // Clear every filter to "show everything". Uses "all" for timeWindow because
    // the store's reset() defaults to "7d" which hides older expenses.
    applyFilters({
      timeWindow: "all",
      selectedMonth: null,
      selectedCategories: [],
      selectedPaymentMethods: [],
      selectedPaymentInstruments: [],
      selectedCurrency: null,
      searchQuery: "",
      minAmount: null,
      maxAmount: null,
    })
    void saveFilters().catch((error) => console.warn("Failed to persist filters:", error))
    logAsync("INFO", "UI_ACTION", "RESET_FILTERS")
  }, [applyFilters, saveFilters])

  const filterIconColor = activeCount > 0 ? theme.accentForeground : theme.foreground

  // Empty state
  if (state.activeExpenses.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text
          style={[layoutStyles.emptyText, { opacity: UI_OPACITY.subtle }]}
          className="text-foreground"
        >
          {t("history.emptyTitle")}
        </Text>
        <Text style={[layoutStyles.emptySubtext]} className="text-muted-foreground">
          {t("history.emptySubtitle")}
        </Text>
      </View>
    )
  }

  // Filtered empty state
  if (filteredExpenses.length === 0 && hasActive) {
    return (
      <View className="flex-1 bg-background px-5 pt-5">
        {/* Filter row: chips + filter button inline */}
        <View className="mb-3 flex-row items-center gap-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: UI_SPACE.control }}
            style={{ flex: 1 }}
          >
            {filterChips.map((chip) => (
              <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </ScrollView>

          <Button
            size="chip"
            variant={activeCount > 0 ? "accent" : undefined}
            className="gap-2"
            onPress={handleOpenFilterSheet}
            accessibilityLabel={t("common.filters")}
          >
            <Filter size={16} color={filterIconColor} />
            {activeCount > 0
              ? `${t("common.filters")} (${activeCount})`
              : t("common.filters")}
          </Button>
        </View>

        <View className="flex-1 items-center justify-center p-6">
          <Text
            style={[layoutStyles.emptyText, { opacity: UI_OPACITY.subtle }]}
            className="text-foreground"
          >
            {t("history.noResultsTitle")}
          </Text>
          <Text style={[layoutStyles.emptySubtext]} className="text-muted-foreground">
            {t("history.noResultsSubtitle")}
          </Text>
          <Button
            size="control"
            onPress={handleResetFilters}
            className="mt-4"
            accessibilityLabel={t("common.clearFilters")}
          >
            {t("common.clearFilters")}
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background px-5 pt-4">
      {/* Filter row: chips + filter button inline */}
      <View className="mb-3 flex-row items-center gap-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: UI_SPACE.control }}
          style={{ flex: 1 }}
        >
          {filterChips.map((chip) => (
            <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </ScrollView>

        <Button
          size="chip"
          variant={activeCount > 0 ? "accent" : undefined}
          className="gap-2"
          onPress={handleOpenFilterSheet}
          accessibilityLabel={t("common.filters")}
        >
          <Filter size={16} color={filterIconColor} />
          {activeCount > 0
            ? `${t("common.filters")} (${activeCount})`
            : t("common.filters")}
        </Button>
      </View>

      {/* List - FlashList for optimal performance with large datasets */}
      <View style={{ flex: 1, opacity: isFilterStale ? 0.6 : 1 }}>
        <FlashList
          data={flattenedExpenses}
          renderItem={renderFlashListItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          overrideItemLayout={overrideItemLayout}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={ListFooterComponent}
        />
      </View>

      {/* Delete Confirmation Dialog */}
      <Modal
        transparent
        animationType="fade"
        visible={!!deletingExpenseId}
        onRequestClose={() => setDeletingExpenseId(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm gap-4 rounded-card bg-surface border border-border p-6">
            <Text className="text-lg font-semibold text-foreground">
              {t("history.deleteDialog.title")}
            </Text>
            <Text className="text-[13px] text-muted-foreground">
              {t("history.deleteDialog.description")}
            </Text>
            <View className="flex-row justify-end gap-3">
              <Button
                size="control"
                onPress={() => setDeletingExpenseId(null)}
                accessibilityLabel={t("common.cancel")}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="control"
                variant="destructive"
                onPress={confirmDelete}
                accessibilityLabel={t("common.delete")}
              >
                {t("common.delete")}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}
