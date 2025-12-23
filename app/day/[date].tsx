import React from "react"
import { useLocalSearchParams, Stack } from "expo-router"
import { YStack, Text, Card, H4, XStack, Button, useTheme, ScrollView } from "tamagui"
import { useExpenses } from "../../context/ExpenseContext"
import { format, parseISO } from "date-fns"
import { CATEGORIES } from "../../constants/categories"
import { Trash } from "@tamagui/lucide-icons"
import { Alert } from "react-native"

export default function DayExpensesScreen() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const { state, deleteExpense } = useExpenses()
  const theme = useTheme()

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
      : { color: (theme.gray10?.val as string) || "gray", label: "Other" }
  }

  // Format date for display: dd/MM/yyyy
  const formattedDisplayDate = date
    ? format(parseISO(date), "dd/MM/yyyy")
    : "Invalid Date"

  return (
    <YStack
      flex={1}
      style={{ backgroundColor: (theme.background?.val as string) || "white" }}
    >
      <Stack.Screen options={{ title: formattedDisplayDate, headerBackTitle: "Back" }} />

      <ScrollView>
        <H4 style={{ marginBottom: 16 }}>Transactions for {formattedDisplayDate}</H4>

        {dayExpenses.length === 0 ? (
          <Text
            style={{
              color: (theme.gray10?.val as string) || "gray",
              textAlign: "center",
              marginTop: 20,
            }}
          >
            No expenses found for this date.
          </Text>
        ) : (
          dayExpenses.map((expense) => {
            const categoryInfo = getCategoryIcon(expense.category)
            return (
              <Card
                key={expense.id}
                bordered
                style={{
                  marginBottom: 12,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <XStack flex={1} style={{ gap: 12, alignItems: "center" }}>
                  <YStack
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 16,
                      backgroundColor: categoryInfo.color,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{categoryInfo.label[0]}</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                      {expense.note || categoryInfo.label}
                    </Text>
                    <Text
                      style={{
                        color: (theme.gray10?.val as string) || "gray",
                        fontSize: 12,
                      }}
                    >
                      {format(parseISO(expense.date), "h:mm a")} • {expense.category}
                    </Text>
                  </YStack>
                </XStack>

                <XStack style={{ alignItems: "center", gap: 12 }}>
                  <Text
                    style={{
                      fontWeight: "bold",
                      fontSize: 16,
                      color: (theme.red10?.val as string) || "red",
                    }}
                  >
                    -₹{expense.amount.toFixed(2)}
                  </Text>
                  <Button
                    size="$2"
                    icon={Trash}
                    chromeless
                    onPress={() => handleDelete(expense.id)}
                    aria-label="Delete"
                  />
                </XStack>
              </Card>
            )
          })
        )}
      </ScrollView>
    </YStack>
  )
}
