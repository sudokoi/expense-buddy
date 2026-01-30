import { format, subDays } from "date-fns"
import { getLocalDayKey, formatDate } from "../../utils/date"
import { YStack, H4, XStack, Card, Text, Button, useTheme, ScrollView } from "tamagui"
import { BarChart } from "react-native-gifted-charts"
import { useExpenses, useCategories } from "../../stores/hooks"
import { useRouter } from "expo-router"
import { Dimensions, ViewStyle, TextStyle } from "react-native"
import React from "react"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { CARD_COLORS } from "../../constants/theme-colors"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import { useTranslation } from "react-i18next"
import {
  formatCurrency,
  getCurrencySymbol,
  getFallbackCurrency,
  computeEffectiveCurrency,
} from "../../utils/currency"
import { groupExpensesByCurrency } from "../../utils/analytics-calculations"
import { useSettings } from "../../stores/hooks"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  } as ViewStyle,
  summaryCardsRow: {
    gap: 12,
    marginBottom: 20,
  } as ViewStyle,
  chartSection: {
    marginBottom: 20,
  } as ViewStyle,
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  } as ViewStyle,
  transactionsHeader: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  transactionDetails: {
    gap: 12,
    alignItems: "center",
  } as ViewStyle,
  cardValue: {
    marginTop: 8,
    height: 40, // Fixed height to ensure alignment across cards
    justifyContent: "center", // Center content vertically within the fixed height
  } as TextStyle,
}

// Memoized recent expense item component
interface RecentExpenseItemProps {
  expense: Expense
  categoryInfo: Pick<Category, "label" | "icon" | "color">
}

const RecentExpenseItem = React.memo(function RecentExpenseItem({
  expense,
  categoryInfo,
}: RecentExpenseItemProps) {
  return (
    <ExpenseRow
      expense={expense}
      categoryInfo={categoryInfo}
      instruments={[]}
      subtitleMode="date"
      showPaymentMethod={false}
      showActions={false}
    />
  )
})

export default function DashboardScreen() {
  const { state } = useExpenses()
  const { categories, getCategoryByLabel } = useCategories()
  const { settings } = useSettings()
  // Keep theme only for BarChart which requires raw color values
  const theme = useTheme()
  const router = useRouter()
  const screenWidth = Dimensions.get("window").width
  const { t } = useTranslation()

  const [selectedCurrency, setSelectedCurrency] = React.useState<string | null>(null)

  // Singleton pass to group expenses by currency
  const { availableCurrencies, expensesByCurrency } = React.useMemo(() => {
    const grouped = groupExpensesByCurrency(state.activeExpenses, getFallbackCurrency())
    const available = Array.from(grouped.keys()).sort()
    return { availableCurrencies: available, expensesByCurrency: grouped }
  }, [state.activeExpenses])

  // Determine effective currency
  const effectiveCurrency = React.useMemo(() => {
    return computeEffectiveCurrency(
      selectedCurrency,
      availableCurrencies,
      expensesByCurrency,
      settings.defaultCurrency
    )
  }, [selectedCurrency, availableCurrencies, expensesByCurrency, settings.defaultCurrency])

  const currencyExpenses = React.useMemo(() => {
    return expensesByCurrency.get(effectiveCurrency) || []
  }, [expensesByCurrency, effectiveCurrency])

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
            marginBottom: 2,
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
  const handleAddPress = React.useCallback(() => {
    router.push("/(tabs)/add")
  }, [router])

  const handleAnalyticsPress = React.useCallback(() => {
    router.push("/(tabs)/analytics")
  }, [router])

  const handleHistoryPress = React.useCallback(() => {
    router.push("/(tabs)/history")
  }, [router])

  return (
    <ScreenContainer>
      {/* Header */}
      <XStack style={layoutStyles.headerRow}>
        <YStack>
          <H4 numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t("dashboard.title")}
          </H4>
          <Text color="$color" opacity={0.6}>
            {t("dashboard.welcome")}
          </Text>
        </YStack>
        <Button size="$4" themeInverse onPress={handleAddPress}>
          {t("common.add")}
        </Button>
      </XStack>

      {/* Currency Filter - Show only if multiple currencies exist */}
      {availableCurrencies.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 } as any}
        >
          {availableCurrencies.map((c) => (
            <Button
              key={c}
              size="$2"
              onPress={() => setSelectedCurrency(c)}
              themeInverse={effectiveCurrency === c}
              bordered={effectiveCurrency !== c}
              style={{ borderRadius: 999 }}
            >
              {c} ({getCurrencySymbol(c)})
            </Button>
          ))}
        </ScrollView>
      )}

      {/* Summary Cards */}
      <XStack style={layoutStyles.summaryCardsRow}>
        <Card flex={1} bordered padding="$4" backgroundColor={CARD_COLORS.blue.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$3"
            color={CARD_COLORS.blue.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("dashboard.totalSpent")}
          </Text>
          <H4
            style={layoutStyles.cardValue}
            color={CARD_COLORS.blue.accent}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {formatCurrency(totalExpenses, effectiveCurrency)}
          </H4>
        </Card>
        <Card flex={1} bordered padding="$4" backgroundColor={CARD_COLORS.green.bg}>
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$3"
            color={CARD_COLORS.green.text}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {t("dashboard.entries")}
          </Text>
          <H4
            style={layoutStyles.cardValue}
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
      <YStack gap="$4" style={layoutStyles.chartSection}>
        <XStack style={layoutStyles.transactionsHeader}>
          <YStack flex={1} mr="$2">
            <SectionHeader>{t("dashboard.last7Days")}</SectionHeader>
          </YStack>
          <Button chromeless size="$2" onPress={handleAnalyticsPress}>
            {t("dashboard.viewAnalytics")}
          </Button>
        </XStack>
        {hasData ? (
          <YStack style={layoutStyles.chartContainer}>
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
            bordered
            padding="$4"
            alignItems="center"
            justifyContent="center"
            height={150}
          >
            <Text color="$color" opacity={0.6}>
              {t("dashboard.noData")}
            </Text>
          </Card>
        )}
      </YStack>

      {/* Recent Transactions List (Mini) */}
      <YStack>
        <XStack style={layoutStyles.transactionsHeader}>
          <YStack flex={1} mr="$2">
            <SectionHeader>{t("dashboard.recentTransactions")}</SectionHeader>
          </YStack>
          <Button chromeless size="$2" onPress={handleHistoryPress}>
            {t("common.seeAll")}
          </Button>
        </XStack>

        {recentExpenses.length === 0 && (
          <Text color="$color" opacity={0.6}>
            {t("dashboard.noRecent")}
          </Text>
        )}

        {recentExpenses.map((expense) => (
          <RecentExpenseItem
            key={expense.id}
            expense={expense}
            categoryInfo={
              categoryByLabel.get(expense.category) ??
              ({
                label: expense.category,
                icon: "Circle",
                color: CATEGORY_COLORS.Other,
              } satisfies Pick<Category, "label" | "icon" | "color">)
            }
          />
        ))}
      </YStack>
    </ScreenContainer>
  )
}
