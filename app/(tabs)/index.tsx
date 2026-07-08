import { format, subDays } from "date-fns"
import { getLocalDayKey, formatDate } from "../../utils/date"
import { YStack, H4, XStack, Card, Text, Button, useTheme, ScrollView } from "tamagui"
import { BarChart } from "react-native-gifted-charts"
import { useCategories, useDerivedExpenseData } from "../../stores/hooks"
import { useRouter } from "expo-router"
import { Dimensions } from "react-native"
import React, { startTransition } from "react"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { RefreshCw, Download } from "@tamagui/lucide-icons-2"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { IconActionButton } from "../../components/ui/IconActionButton"
import { useSyncAction } from "../../hooks/use-sync-action"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { CARD_COLORS } from "../../constants/theme-colors"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import { useTranslation } from "react-i18next"
import { logAsync } from "../../services/logger"
import { formatCurrency, getCurrencySymbol } from "../../utils/currency"
import { useFilters, useFilterPersistence } from "../../stores/filter-store"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"

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

// Memoized recent expense item component
interface RecentExpenseItemProps {
  expense: Expense
  categoryInfo: Pick<Category, "label" | "icon" | "color">
}

// Stable empty list so RecentExpenseItem's memoized ExpenseRow isn't passed a
// fresh [] identity on every dashboard render.
const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

const RecentExpenseItem = React.memo(function RecentExpenseItem({
  expense,
  categoryInfo,
}: RecentExpenseItemProps) {
  return (
    <ExpenseRow
      expense={expense}
      categoryInfo={categoryInfo}
      instruments={EMPTY_INSTRUMENTS}
      subtitleMode="date"
      showPaymentMethod={false}
      showActions={false}
    />
  )
})

export default function DashboardScreen() {
  const { categories, getCategoryByLabel } = useCategories()
  // Keep theme only for BarChart which requires raw color values
  const theme = useTheme()
  const router = useRouter()
  const screenWidth = Dimensions.get("window").width
  const { t } = useTranslation()
  const { handleSync, isSyncing } = useSyncAction()
  const { isScanningSmsImports, startSmsImportFromAdd } = useSmsImportActions()

  // Currency selection is shared across the app via the filter store, so choosing
  // a currency here also scopes History and Analytics (and vice versa).
  const { setSelectedCurrency } = useFilters()
  const { save: saveFilters } = useFilterPersistence()

  // Pre-computed derived data (shared across all tabs)
  const { availableCurrencies, currencyExpenses, effectiveCurrency } =
    useDerivedExpenseData()

  const handleCurrencySelect = React.useCallback(
    (currency: string) => {
      logAsync("INFO", "UI_ACTION", "DASHBOARD_CURRENCY_FILTER")
      startTransition(() => setSelectedCurrency(currency))
      void saveFilters().catch((error) =>
        console.warn("Failed to persist currency selection:", error)
      )
    },
    [setSelectedCurrency, saveFilters]
  )

  // Use currencyExpenses for calculations
  const totalExpenses = React.useMemo(
    () => currencyExpenses.reduce((sum, item) => sum + item.amount, 0),
    [currencyExpenses]
  )
  const recentExpenses = React.useMemo(
    () => currencyExpenses.slice(0, 5),
    [currencyExpenses]
  )

  const categoryByLabel = React.useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) {
      map.set(category.label, category)
    }
    return map
  }, [categories])

  const chartData = React.useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {}
    const last7Days: string[] = []

    // Generate last 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      last7Days.push(format(d, "yyyy-MM-dd"))
    }

    // Aggregate using currencyExpenses (excludes soft-deleted)
    currencyExpenses.forEach((e) => {
      const dateKey = getLocalDayKey(e.date)
      if (!grouped[dateKey]) grouped[dateKey] = {}
      if (!grouped[dateKey][e.category]) grouped[dateKey][e.category] = 0
      grouped[dateKey][e.category] += e.amount
    })

    // Format for Chart - only include days with actual expenses
    return last7Days
      .map((dateKey) => {
        const dayExpenses = grouped[dateKey] || {}
        const stacks = Object.keys(dayExpenses).map((cat) => {
          const categoryConfig = getCategoryByLabel(cat)
          return {
            value: dayExpenses[cat],
            color: categoryConfig?.color || CATEGORY_COLORS.Other,
            marginBottom: UI_SPACE.micro / 2,
          }
        })

        return {
          stacks: stacks,
          label: formatDate(dateKey, "dd/MM"), // Use formatDate for localized month if needed eventually, though dd/MM is numeric
          onPress: () => router.push(`/day/${dateKey}`),
          dateKey, // Keep for filtering
        }
      })
      .filter((item) => item.stacks.length > 0) // Only show days with data
  }, [currencyExpenses, router, getCategoryByLabel])

  const hasData = chartData.some((d) => d.stacks && d.stacks.length > 0)

  // Generate a unique key for the chart based on data to force re-render
  const chartKey = React.useMemo(() => {
    const total = currencyExpenses.reduce((sum, e) => sum + e.amount, 0)
    return `chart-${currencyExpenses.length}-${total}`
  }, [currencyExpenses])

  // Get theme colors for BarChart which requires raw color values (third-party component)
  const chartTextColor = theme.color.val as string

  // Format Y-axis labels to handle large numbers (e.g., 27000 → 27K)
  const formatYLabel = React.useCallback((value: string) => {
    const num = parseFloat(value)
    if (num >= 100000) {
      return `${(num / 100000).toFixed(1)}L`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`
    }
    return value
  }, [])

  // Memoized navigation handlers
  const handleImportPress = React.useCallback(() => {
    void startSmsImportFromAdd()
  }, [startSmsImportFromAdd])

  const handleAnalyticsPress = React.useCallback(() => {
    router.push("/(tabs)/analytics")
  }, [router])

  const handleHistoryPress = React.useCallback(() => {
    router.push("/(tabs)/history")
  }, [router])

  return (
    <ScreenContainer>
      {/* Header */}
      <XStack justify="space-between" items="center" mb={UI_SPACE.gutter}>
        <Text color="$color" opacity={UI_OPACITY.subtle}>
          {t("dashboard.welcome")}
        </Text>
        <XStack gap={UI_SPACE.control} items="center" px={UI_SPACE.micro}>
          <IconActionButton
            icon={<RefreshCw size={20} />}
            onPress={handleSync}
            tooltip={t("settings.autoSync.syncNow")}
            disabled={isSyncing}
            spinning={isSyncing}
            accessibilityLabel={t("settings.autoSync.syncNow")}
            tooltipAlign="right"
          />
          <IconActionButton
            icon={<Download size={20} />}
            onPress={handleImportPress}
            tooltip={t("settings.smsImport.actions.review")}
            disabled={isScanningSmsImports}
            accessibilityLabel={t("settings.smsImport.actions.review")}
            tooltipAlign="right"
          />
        </XStack>
      </XStack>

      {/* Currency Filter - Show only if multiple currencies exist */}
      {availableCurrencies.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: UI_SPACE.control, pb: UI_SPACE.gutter }}
        >
          {availableCurrencies.map((c) => (
            <Button
              key={c}
              size="$chip"
              px="$control"
              onPress={() => handleCurrencySelect(c)}
              theme={effectiveCurrency === c ? "accent" : undefined}
              borderColor="$borderColor"
              borderWidth={effectiveCurrency !== c ? UI_BORDER_WIDTH.thin : 0}
              rounded={UI_RADIUS.round}
            >
              {c} ({getCurrencySymbol(c)})
            </Button>
          ))}
        </ScrollView>
      )}

      {/* Summary Cards */}
      <XStack gap={UI_SPACE.control} mb={UI_SPACE.section}>
        <Card
          flex={1}
          borderWidth={UI_BORDER_WIDTH.thin}
          borderColor="$borderColor"
          p="$block"
          bg={CARD_COLORS.blue.bg}
          onPress={handleAnalyticsPress}
        >
          <Text
            fontWeight={UI_FONT_WEIGHT.bold}
            textTransform="uppercase"
            fontSize="$body"
            color={CARD_COLORS.blue.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("dashboard.totalSpent")}
          </Text>
          <H4
            mt={UI_SPACE.control}
            height={UI_SPACE.empty}
            justify="center"
            color={CARD_COLORS.blue.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {formatCurrency(totalExpenses, effectiveCurrency)}
          </H4>
        </Card>
        <Card
          flex={1}
          borderWidth={UI_BORDER_WIDTH.thin}
          borderColor="$borderColor"
          p="$block"
          bg={CARD_COLORS.green.bg}
          onPress={handleHistoryPress}
        >
          <Text
            fontWeight={UI_FONT_WEIGHT.bold}
            textTransform="uppercase"
            fontSize="$body"
            color={CARD_COLORS.green.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("dashboard.entries")}
          </Text>
          <H4
            mt={UI_SPACE.control}
            height={UI_SPACE.empty}
            justify="center"
            color={CARD_COLORS.green.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {currencyExpenses.length}
          </H4>
        </Card>
      </XStack>

      {/* Chart Section */}
      <YStack gap="$gutter" mb={UI_SPACE.section}>
        <XStack justify="space-between" items="center">
          <YStack flex={1} mr="$control">
            <SectionHeader>{t("dashboard.last7Days")}</SectionHeader>
          </YStack>
          <Button chromeless size="$chip" px="$control" onPress={handleAnalyticsPress}>
            {t("dashboard.viewAnalytics")}
          </Button>
        </XStack>
        {hasData ? (
          <YStack items="center" justify="center" mb={UI_SPACE.section}>
            {/* BarChart requires raw color values - keeping theme.xxx.val for third-party component */}
            <BarChart
              key={chartKey}
              stackData={chartData}
              barWidth={24}
              noOfSections={3}
              barBorderRadius={4}
              yAxisThickness={0}
              xAxisThickness={0}
              height={200}
              width={screenWidth - 60}
              isAnimated
              xAxisLabelTextStyle={{
                color: chartTextColor,
                fontSize: 10,
              }}
              yAxisTextStyle={{ color: chartTextColor }}
              yAxisLabelWidth={50}
              formatYLabel={formatYLabel}
              spacing={20}
            />
          </YStack>
        ) : (
          <Card
            borderWidth={UI_BORDER_WIDTH.thin}
            borderColor="$borderColor"
            p="$gutter"
            items="center"
            justify="center"
            height={150}
          >
            <Text color="$color" opacity={UI_OPACITY.subtle}>
              {t("dashboard.noData")}
            </Text>
          </Card>
        )}
      </YStack>

      {/* Recent Transactions List (Mini) */}
      <YStack>
        <XStack justify="space-between" items="center">
          <YStack flex={1} mr="$control">
            <SectionHeader>{t("dashboard.recentTransactions")}</SectionHeader>
          </YStack>
          <Button chromeless size="$chip" px="$control" onPress={handleHistoryPress}>
            {t("common.seeAll")}
          </Button>
        </XStack>

        {recentExpenses.length === 0 && (
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {t("dashboard.noRecent")}
          </Text>
        )}

        {recentExpenses.map((expense) => (
          <RecentExpenseItem
            key={expense.id}
            expense={expense}
            categoryInfo={
              categoryByLabel.get(expense.category) ??
              getFallbackCategory(expense.category)
            }
          />
        ))}
      </YStack>
    </ScreenContainer>
  )
}
