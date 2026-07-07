import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react"
import { YStack, Text, XStack, Button, H6, Dialog, ScrollView } from "tamagui"
import { Filter, X } from "@tamagui/lucide-icons-2"
import { BackHandler, View } from "react-native"
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
import { getPaymentMethodI18nKey } from "../../constants/payment-methods"
import { getLocalDayKey, formatDate } from "../../utils/date"
import type { Expense, PaymentMethodType } from "../../types/expense"
import type { Category } from "../../types/category"
import { syncDownMore } from "../../services/sync-manager"
import {
  findInstrumentById,
  formatPaymentInstrumentLabel,
  getActivePaymentInstruments,
  PAYMENT_INSTRUMENT_METHODS,
} from "../../services/payment-instruments"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { useTranslation } from "react-i18next"
import type {
  PaymentMethodSelectionKey,
  PaymentInstrumentSelectionKey,
} from "../../types/analytics"
import { applyAllFilters } from "../../utils/analytics/filters"
import { getCurrencySymbol } from "../../utils/currency"
import { formatMonthLabel, isTimeWindowCovered } from "../../utils/analytics/time"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"

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
    fontSize: 24,
  },
  emptySubtext: {
    fontSize: 16,
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
  return (
    <Button
      size="$chip"
      px="$control"
      borderWidth={UI_BORDER_WIDTH.thin}
      borderColor="$borderColor"
      onPress={() => {
        logAsync("INFO", "UI_ACTION", "REMOVE_FILTER_CHIP")
        onRemove()
      }}
      style={{
        borderRadius: UI_RADIUS.round,
      }}
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
  const router = useRouter()
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
          category: `${filters.selectedCategories.length} (${formatListBreakdown(filters.selectedCategories)})`,
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
          method: paymentMethodLabel(only),
        }),
        onRemove: () => startTransition(() => setSelectedPaymentMethods([])),
      })
    } else {
      chips.push({
        label: t("analytics.filters.payment", {
          method: `${filters.selectedPaymentMethods.length} (${formatListBreakdown(filters.selectedPaymentMethods.map(paymentMethodLabel))})`,
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
              allInstruments
            ),
          }),
          onRemove: () => startTransition(() => setSelectedPaymentInstruments([])),
        })
      } else {
        chips.push({
          label: t("analytics.filters.instrument", {
            instrument: formatSelectedPaymentInstrumentsSummary(
              filters.selectedPaymentInstruments
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
    formatListBreakdown,
    paymentMethodLabel,
    formatSelectedPaymentInstrumentLabel,
    formatSelectedPaymentInstrumentsSummary,
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
          <YStack background="$background" py={UI_SPACE.control}>
            <H6 color="$color" opacity={UI_OPACITY.strong}>
              {item.title}
            </H6>
          </YStack>
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
        <YStack p={UI_SPACE.gutter} items="center">
          <Button
            size="$control"
            theme="accent"
            onPress={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? t("history.loading") : t("history.loadMore")}
          </Button>
        </YStack>
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

  // Empty state
  if (state.activeExpenses.length === 0) {
    return (
      <YStack
        flex={1}
        bg="$background"
        items="center"
        justify="center"
        p={UI_SPACE.gutter}
      >
        <Text style={layoutStyles.emptyText} color="$color" opacity={UI_OPACITY.strong}>
          {t("history.emptyTitle")}
        </Text>
        <Text
          style={layoutStyles.emptySubtext}
          color="$color"
          opacity={UI_OPACITY.subtle}
        >
          {t("history.emptySubtitle")}
        </Text>
      </YStack>
    )
  }

  // Filtered empty state
  if (filteredExpenses.length === 0 && hasActive) {
    return (
      <YStack flex={1} bg="$background" px={UI_SPACE.gutter} pt={UI_SPACE.gutter}>
        {/* Filter row: chips + filter button inline */}
        <XStack
          mb={UI_SPACE.section}
          gap="$control"
          style={{ alignItems: "center" }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: UI_SPACE.control }}
            style={{ flex: 1 }}
          >
            {filterChips.map((chip, index) => (
              <FilterChip key={index} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </ScrollView>

          <Button
            size="$chip"
            px="$control"
            icon={Filter}
            onPress={handleOpenFilterSheet}
            theme={activeCount > 0 ? "accent" : undefined}
          >
            {activeCount > 0
              ? `${t("common.filters")} (${activeCount})`
              : t("common.filters")}
          </Button>
        </XStack>

        <YStack flex={1} items="center" justify="center" p={UI_SPACE.gutter}>
          <Text style={layoutStyles.emptyText} color="$color" opacity={UI_OPACITY.strong}>
            {t("history.noResultsTitle")}
          </Text>
          <Text
            style={layoutStyles.emptySubtext}
            color="$color"
            opacity={UI_OPACITY.subtle}
          >
            {t("history.noResultsSubtitle")}
          </Text>
          <Button
            size="$control"
            onPress={handleResetFilters}
            style={{ marginTop: UI_SPACE.gutter }}
          >
            {t("common.clearFilters")}
          </Button>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background" px={UI_SPACE.gutter} pt={UI_SPACE.gutter}>
      {/* Filter row: chips + filter button inline */}
      <XStack
        mb={UI_SPACE.section}
        gap="$control"
        style={{ alignItems: "center" }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: UI_SPACE.control }}
          style={{ flex: 1 }}
        >
          {filterChips.map((chip, index) => (
            <FilterChip key={index} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </ScrollView>

        <Button
          size="$chip"
          px="$control"
          icon={Filter}
          onPress={handleOpenFilterSheet}
          theme={activeCount > 0 ? "accent" : undefined}
        >
          {activeCount > 0
            ? `${t("common.filters")} (${activeCount})`
            : t("common.filters")}
        </Button>
      </XStack>

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
      <Dialog
        open={!!deletingExpenseId}
        onOpenChange={(open) => !open && setDeletingExpenseId(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay key="overlay" opacity={UI_OPACITY.faint} />
          <Dialog.Content
            borderWidth={UI_BORDER_WIDTH.thin}
            borderColor="$borderColor"
            elevate
            key="content"
            gap="$gutter"
          >
            <Dialog.Title size="$sectionTitle">
              {t("history.deleteDialog.title")}
            </Dialog.Title>
            <Dialog.Description>
              {t("history.deleteDialog.description")}
            </Dialog.Description>
            <XStack gap="$section" justify="flex-end">
              <Dialog.Close asChild>
                <Button size="$control">{t("common.cancel")}</Button>
              </Dialog.Close>
              <Button size="$control" theme="red" onPress={confirmDelete}>
                {t("common.delete")}
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  )
}
