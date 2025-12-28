import { format, parseISO, subDays } from "date-fns"
import { YStack, H4, XStack, Card, Text, Button, SizableText, useTheme } from "tamagui"
import { useToastController } from "@tamagui/toast"
import { BarChart } from "react-native-gifted-charts"
import { useExpenses } from "../../context/ExpenseContext"
import { useRouter } from "expo-router"
import { Dimensions, ViewStyle, TextStyle } from "react-native"
import { CATEGORIES } from "../../constants/categories"
import React from "react"
import {
  ExpenseCard,
  AmountText,
  CategoryIcon,
  ScreenContainer,
  SectionHeader,
} from "../../components/ui"

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
  } as TextStyle,
}

export default function DashboardScreen() {
  const { state, clearSyncNotification } = useExpenses()
  // Keep theme only for BarChart which requires raw color values
  const theme = useTheme()
  const router = useRouter()
  const screenWidth = Dimensions.get("window").width
  const toast = useToastController()

  const totalExpenses = state.expenses.reduce((sum, item) => sum + item.amount, 0)
  const recentExpenses = state.expenses.slice(0, 5)

  const chartData = React.useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {}
    const last7Days: string[] = []

    // Generate last 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      last7Days.push(format(d, "yyyy-MM-dd"))
    }

    // Aggregate
    state.expenses.forEach((e) => {
      const dateKey = e.date.split("T")[0]
      if (!grouped[dateKey]) grouped[dateKey] = {}
      if (!grouped[dateKey][e.category]) grouped[dateKey][e.category] = 0
      grouped[dateKey][e.category] += e.amount
    })

    // Format for Chart - only include days with actual expenses
    return last7Days
      .map((dateKey) => {
        const dayExpenses = grouped[dateKey] || {}
        const stacks = Object.keys(dayExpenses).map((cat) => {
          const categoryConfig = CATEGORIES.find((c) => c.value === cat)
          return {
            value: dayExpenses[cat],
            color: categoryConfig?.color || "#888",
            marginBottom: 2,
          }
        })

        return {
          stacks: stacks,
          label: format(parseISO(dateKey), "dd/MM"),
          onPress: () => router.push(`/day/${dateKey}`),
          dateKey, // Keep for filtering
        }
      })
      .filter((item) => item.stacks.length > 0) // Only show days with data
  }, [state.expenses, router])

  const hasData = chartData.some((d) => d.stacks && d.stacks.length > 0)

  // Generate a unique key for the chart based on data to force re-render
  const chartKey = React.useMemo(() => {
    const total = state.expenses.reduce((sum, e) => sum + e.amount, 0)
    return `chart-${state.expenses.length}-${total}`
  }, [state.expenses])

  // Show toast when sync notification is available
  React.useEffect(() => {
    if (state.syncNotification) {
      toast.show(state.syncNotification.message, {
        message: `${state.syncNotification.newItemsCount} new, ${state.syncNotification.updatedItemsCount} updated`,
        duration: 4000,
      })
      // Clear notification after showing
      setTimeout(() => clearSyncNotification(), 500)
    }
  }, [state.syncNotification, clearSyncNotification, toast])

  // Get theme colors for BarChart which requires raw color values (third-party component)
  const chartTextColor = theme.color.val as string
  // Theme colors - use getColorValue for Tamagui component compatibility

  return (
    <ScreenContainer>
      {/* Header */}
      <XStack style={layoutStyles.headerRow}>
        <YStack>
          <H4>Dashboard</H4>
          <Text color="$color" opacity={0.6}>
            Welcome back!
          </Text>
        </YStack>
        <Button size="$3" themeInverse onPress={() => router.push("/(tabs)/add")}>
          + Add
        </Button>
      </XStack>

      {/* Summary Cards */}
      <XStack style={layoutStyles.summaryCardsRow}>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          padding="$4"
          backgroundColor={theme.blue3}
        >
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$3"
            color={theme.blue11}
          >
            Total Spent
          </Text>
          <H4 style={layoutStyles.cardValue} color={theme.blue12}>
            ₹{totalExpenses.toFixed(2)}
          </H4>
        </Card>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          padding="$4"
          backgroundColor={theme.green3}
        >
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="$3"
            color={theme.green11}
          >
            Entries
          </Text>
          <H4 style={layoutStyles.cardValue} color={theme.green12}>
            {state.expenses.length}
          </H4>
        </Card>
      </XStack>

      {/* Chart Section */}
      <YStack gap="$4" style={layoutStyles.chartSection}>
        <XStack style={layoutStyles.transactionsHeader}>
          <SectionHeader>Last 7 Days</SectionHeader>
          <Button chromeless size="$2" onPress={() => router.push("/(tabs)/analytics")}>
            View Analytics
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
              No data to display yet.
            </Text>
          </Card>
        )}
      </YStack>

      {/* Recent Transactions List (Mini) */}
      <YStack gap="$3">
        <XStack style={layoutStyles.transactionsHeader}>
          <SectionHeader>Recent Transactions</SectionHeader>
          <Button chromeless size="$2" onPress={() => router.push("/(tabs)/history")}>
            See All
          </Button>
        </XStack>

        {recentExpenses.length === 0 && (
          <Text color="$color" opacity={0.6}>
            No recent transactions.
          </Text>
        )}

        {recentExpenses.map((expense) => {
          const cat = CATEGORIES.find((c) => c.value === expense.category)
          const Icon = cat?.icon
          return (
            <ExpenseCard key={expense.id}>
              <XStack style={layoutStyles.transactionDetails}>
                <CategoryIcon backgroundColor={cat?.color || "#888"}>
                  {Icon && <Icon color="white" size={16} />}
                </CategoryIcon>
                <YStack>
                  <SizableText size="$4" fontWeight="bold">
                    {expense.note || cat?.label}
                  </SizableText>
                  <Text fontSize="$2" color="$color" opacity={0.6}>
                    {format(parseISO(expense.date), "dd/MM/yyyy")} • {cat?.label}
                  </Text>
                </YStack>
              </XStack>
              <AmountText type="expense">-₹{expense.amount.toFixed(2)}</AmountText>
            </ExpenseCard>
          )
        })}
      </YStack>
    </ScreenContainer>
  )
}
