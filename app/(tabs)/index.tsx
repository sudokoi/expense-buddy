
import { YStack, H4, XStack, Card, Text, Button, SizableText, ScrollView, useTheme } from 'tamagui'
import { BarChart } from 'react-native-gifted-charts'
import { useExpenses } from '../../context/ExpenseContext'
import { useRouter, Href } from 'expo-router'
import { Dimensions } from 'react-native'
import { CATEGORIES } from '../../constants/categories'
import React from 'react'

export default function DashboardScreen() {
  const { state } = useExpenses()
  const theme = useTheme()
  const router = useRouter()
  const screenWidth = Dimensions.get('window').width

  const totalExpenses = state.expenses.reduce((sum, item) => sum + item.amount, 0)
  const recentExpenses = state.expenses.slice(0, 5)

  // Prepare chart data (Last 7 items or grouped by last 7 days - keeping simple for now: last 5-7 individual expenses)
  // Ideally should group by day.
  const chartData = state.expenses
    .slice(0, 7)
    .reverse()
    .map((item) => ({
      value: item.amount,
      label: new Date(item.date).getDate().toString(), // Show Day of month
      frontColor: theme.blue10.val,
    }))

  // If no data, show placeholder
  const hasData = chartData.length > 0

  return (
    <ScrollView flex={1} style={{ backgroundColor: theme.background.val as string }} contentContainerStyle={{ padding: 20 } as any}>
      {/* Header */}
      <XStack style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <YStack>
          <H4>Dashboard</H4>
          <Text style={{ color: (theme.gray10?.val as string) || 'gray' }}>Welcome back!</Text>
        </YStack>
        <Button size="$3" themeInverse onPress={() => router.push('/(tabs)/add' as any)}>
          + Add
        </Button>
      </XStack>

      {/* Summary Cards */}
      <XStack style={{ gap: 12, marginBottom: 20 }}>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          style={{ padding: 16, backgroundColor: theme.blue3.val as string }}
        >
          <Text style={{ color: theme.blue11.val as string, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13 }}>
            Total Spent
          </Text>
          <H4 style={{ color: theme.blue12.val as string, marginTop: 8 }}>
            ₹{totalExpenses.toFixed(2)}
          </H4>
        </Card>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          style={{ padding: 16, backgroundColor: theme.green3.val as string }}
        >
          <Text style={{ color: theme.green11.val as string, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 13 }}>
            Entries
          </Text>
          <H4 style={{ color: theme.green12.val as string, marginTop: 8 }}>
            {state.expenses.length}
          </H4>
        </Card>
      </XStack>

      {/* Chart Section */}
      <YStack space="$4" style={{ marginBottom: 20 }}>
        <H4 fontSize="$5">Recent Activity</H4>
        {hasData ? (
          <YStack style={{ alignItems: 'center', justifyContent: 'center' }}>
            <BarChart
              data={chartData}
              barWidth={22}
              noOfSections={3}
              barBorderRadius={4}
              frontColor={theme.blue10.val as string}
              yAxisThickness={0}
              xAxisThickness={0}
              height={200}
              width={screenWidth - 80} // Adjust for padding
              isAnimated
              xAxisLabelTextStyle={{ color: theme.color.val as string }}
              yAxisTextStyle={{ color: theme.color.val as string }}
            />
          </YStack>
        ) : (
          <Card bordered style={{ padding: 16, alignItems: 'center', justifyContent: 'center', height: 150 }}>
            <Text style={{ color: (theme.gray10?.val as string) || 'gray' }}>No data to display yet.</Text>
          </Card>
        )}
      </YStack>

      {/* Recent Transactions List (Mini) */}
      <YStack space="$3">
        <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <H4 fontSize="$5">Recent Transactions</H4>
          <Button chromeless size="$2" onPress={() => router.push('/(tabs)/history' as any)}>
            See All
          </Button>
        </XStack>
        
        {recentExpenses.length === 0 && <Text style={{ color: (theme.gray10?.val as string) || 'gray' }}>No recent transactions.</Text>}

        {recentExpenses.map((expense) => {
          const cat = CATEGORIES.find((c) => c.value === expense.category)
          return (
            <Card
              key={expense.id}
              bordered
              style={{
                padding: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <XStack style={{ gap: 12, alignItems: 'center' }}>
                <YStack
                  style={{
                    backgroundColor: cat?.color || ((theme.gray8?.val as string) || 'gray'),
                    padding: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                   {cat?.icon && (
                      // @ts-ignore
                      <cat.icon color="white" size={16} />
                   )}
                </YStack>
                <YStack>
                  <SizableText size="$4" fontWeight="bold">
                    {cat?.label}
                  </SizableText>
                  <Text style={{ color: (theme.gray10?.val as string) || 'gray', fontSize: 12 }}>
                    {new Date(expense.date).toLocaleDateString()}
                  </Text>
                </YStack>
              </XStack>
              <H4 style={{ fontWeight: 'bold', color: theme.red10?.val as string || 'red' }}>
                -₹{expense.amount.toFixed(2)}
              </H4>
            </Card>
          )
        })}
      </YStack>
    </ScrollView>
  )
}
