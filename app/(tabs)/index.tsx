import { format, subDays } from "date-fns"
import { getLocalDayKey, formatDate } from "../../utils/date"
import { YStack, H4, XStack, Card, Text, Button, useTheme, ScrollView } from "tamagui"
import { BarChart } from "react-native-gifted-charts"
import { useExpenses, useCategories, useNotifications } from "../../stores/hooks"
import { useRouter } from "expo-router"
import { Animated, Dimensions, Easing, Platform } from "react-native"
import React, { startTransition } from "react"
import { IconActionButton } from "../../components/ui/IconActionButton"
import { ScreenContainer } from "../../components/ui/ScreenContainer"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { CARD_COLORS } from "../../constants/theme-colors"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import { useTranslation } from "react-i18next"
import { logAsync } from "../../services/logger"
import { providerSettingsStore } from "../../services/sync/provider-settings-store"
import {
  formatCurrency,
  getCurrencySymbol,
  getFallbackCurrency,
  computeEffectiveCurrency,
} from "../../utils/currency"
import { groupExpensesByCurrency } from "../../utils/analytics/currency"
import { useSettings } from "../../stores/hooks"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { useSyncEngine } from "../../hooks/use-sync-engine"
import { RefreshCw, Download } from "@tamagui/lucide-icons-2"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
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
  const { settings, syncConfig } = useSettings()
  const { startSmsImportFromAdd } = useSmsImportActions()
  const { addNotification } = useNotifications()
  const syncEngine = useSyncEngine()
  // Keep theme only for BarChart which requires raw color values
  const theme = useTheme()
  const router = useRouter()
  const screenWidth = Dimensions.get("window").width
  const { t } = useTranslation()

  const [selectedCurrency, setSelectedCurrency] = React.useState<string | null>(null)
  const [hasNonGitHubProvider, setHasNonGitHubProvider] = React.useState(false)
  const syncSpin = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    let cancelled = false
    providerSettingsStore.getActiveConfig().then((config) => {
      if (!cancelled) setHasNonGitHubProvider(config !== null && config.kind !== "github")
    })
    return () => {
      cancelled = true
    }
  }, [])

  const hasSyncProvider = syncConfig !== null || hasNonGitHubProvider

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
  }, [
    selectedCurrency,
    availableCurrencies,
    expensesByCurrency,
    settings.defaultCurrency,
  ])

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
  const handleAnalyticsPress = React.useCallback(() => {
    router.push("/(tabs)/analytics")
  }, [router])

  const handleHistoryPress = React.useCallback(() => {
    router.push("/(tabs)/history")
  }, [router])

  const handleSmsImport = React.useCallback(async () => {
    await startSmsImportFromAdd()
  }, [startSmsImportFromAdd])

  const handleSync = React.useCallback(async () => {
    if (syncEngine.isSyncing) return
    logAsync("INFO", "UI_ACTION", "MANUAL_SYNC dashboard")
    const result = await syncEngine.manualSync()
    if (result.error) {
      addNotification(result.error, "error")
      logAsync("ERROR", "UI_ACTION", `MANUAL_SYNC_FAILED error=${result.error}`)
      return
    }
    if (!result.skipped) {
      logAsync("INFO", "UI_ACTION", "MANUAL_SYNC_SUCCESS")
    }
  }, [syncEngine, addNotification])

  React.useEffect(() => {
    if (!syncEngine.isSyncing) {
      syncSpin.stopAnimation()
      syncSpin.setValue(0)
      return
    }

    const loop = Animated.loop(
      Animated.timing(syncSpin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    loop.start()
    return () => loop.stop()
  }, [syncEngine.isSyncing, syncSpin])

  const syncRotate = syncSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  return (
    <ScreenContainer>
      {/* Header */}
      <XStack justify="space-between" items="center" mb={UI_SPACE.gutter}>
        <YStack>
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {t("dashboard.welcome")}
          </Text>
        </YStack>
        <XStack gap={UI_SPACE.control}>
          {hasSyncProvider && (
            <IconActionButton
              size="$control"
              onPress={handleSync}
              icon={
                <Animated.View style={{ transform: [{ rotate: syncRotate }] }}>
                  <RefreshCw size={UI_ICON_SIZE.medium} />
                </Animated.View>
              }
              tooltip={
                syncEngine.isSyncing
                  ? t("settings.autoSync.syncing")
                  : t("settings.autoSync.syncNow")
              }
            />
          )}
          {Platform.OS === "android" ? (
            <IconActionButton
              size="$control"
              theme="accent"
              onPress={handleSmsImport}
              icon={<Download size={UI_ICON_SIZE.medium} />}
              tooltip={t("add.importSms")}
            />
          ) : null}
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
              onPress={() => {
                logAsync("INFO", "UI_ACTION", "DASHBOARD_CURRENCY_FILTER")
                startTransition(() => setSelectedCurrency(c))
              }}
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
