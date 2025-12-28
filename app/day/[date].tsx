import React from "react"
import { useLocalSearchParams, Stack } from "expo-router"
import { YStack, Text, XStack, Button, useTheme } from "tamagui"
import { useExpenses } from "../../context/ExpenseContext"
import { format, parseISO } from "date-fns"
import { CATEGORIES } from "../../constants/categories"
import { Trash } from "@tamagui/lucide-icons"
import { Alert, ViewStyle, TextStyle } from "react-native"
import {
  ExpenseCard,
  AmountText,
  CategoryIcon,
  ScreenContainer,
  SectionHeader,
} from "../../components/ui"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  expenseDetails: {
    alignItems: "center",
  } as ViewStyle,
  actionButtons: {
    alignItems: "center",
  } as ViewStyle,
  emptyText: {
    textAlign: "center",
    marginTop: 20,
  } as TextStyle,
}

export default function DayExpensesScreen() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const { state, deleteExpense } = useExpenses()
  const theme = useTheme()

  const backgroundColor = theme.background?.val as string

  // Filter expenses for this date
  const dayExpenses = React.useMemo(() => {
    if (!date) return []
    return state.expenses.filter((expense) => {
      // Assuming date param is YYYY-MM-DD
      const expenseDate = expense.date.split("T")[0]
      return expenseDate === date
    })
  }, [state.expenses, date])

  const handleDelete = (id: string) => {
    Alert.alert("Delete Expense", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense(id) },
    ])
  }

  const getCategoryIcon = (catValue: string) => {
    const cat = CATEGORIES.find((c) => c.value === catValue)
    return cat
      ? { color: cat.color, label: cat.label }
      : { color: "gray", label: "Other" }
  }

  // Format date for display: dd/MM/yyyy
  const formattedDisplayDate = date
    ? format(parseISO(date), "dd/MM/yyyy")
    : "Invalid Date"

  return (
    <YStack flex={1} style={{ backgroundColor }}>
      <Stack.Screen options={{ title: formattedDisplayDate, headerBackTitle: "Back" }} />

      <ScreenContainer>
        <SectionHeader>Transactions for {formattedDisplayDate}</SectionHeader>

        {dayExpenses.length === 0 ? (
          <Text color="$color" opacity={0.6} style={layoutStyles.emptyText}>
            No expenses found for this date.
          </Text>
        ) : (
          dayExpenses.map((expense) => {
            const categoryInfo = getCategoryIcon(expense.category)
            return (
              <ExpenseCard key={expense.id}>
                <XStack flex={1} gap="$3" style={layoutStyles.expenseDetails}>
                  <CategoryIcon backgroundColor={categoryInfo.color}>
                    <Text fontSize="$6">{categoryInfo.label[0]}</Text>
                  </CategoryIcon>
                  <YStack flex={1}>
                    <Text fontWeight="bold" fontSize="$4">
                      {expense.note || categoryInfo.label}
                    </Text>
                    <Text color="$color" opacity={0.6} fontSize="$2">
                      {format(parseISO(expense.date), "h:mm a")} • {expense.category}
                    </Text>
                  </YStack>
                </XStack>

                <XStack gap="$3" style={layoutStyles.actionButtons}>
                  <AmountText type="expense">-₹{expense.amount.toFixed(2)}</AmountText>
                  <Button
                    size="$2"
                    icon={Trash}
                    chromeless
                    onPress={() => handleDelete(expense.id)}
                    aria-label="Delete"
                  />
                </XStack>
              </ExpenseCard>
            )
          })
        )}
      </ScreenContainer>
    </YStack>
  )
}
