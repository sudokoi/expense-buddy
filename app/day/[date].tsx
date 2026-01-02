import React, { useState, useCallback } from "react"
import { useLocalSearchParams, Stack } from "expo-router"
import { YStack, Text, XStack, Button } from "tamagui"
import { useExpenses } from "../../stores"
import { format, parseISO } from "date-fns"
import { CATEGORIES } from "../../constants/categories"
import { Trash, Edit3 } from "@tamagui/lucide-icons"
import { Alert, ViewStyle, TextStyle } from "react-native"
import {
  ExpenseCard,
  AmountText,
  CategoryIcon,
  ScreenContainer,
  SectionHeader,
  EditExpenseModal,
} from "../../components/ui"
import { formatPaymentMethodDisplay } from "../../utils/payment-method-display"
import type { Expense } from "../../types/expense"

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

// Memoized helper to get category info
const getCategoryInfo = (catValue: string) => {
  const cat = CATEGORIES.find((c) => c.value === catValue)
  return cat ? { color: cat.color, label: cat.label } : { color: "gray", label: "Other" }
}

// Memoized expense item component
interface DayExpenseItemProps {
  expense: Expense
  onDelete: (id: string) => void
  onEdit: (expense: Expense) => void
}

const DayExpenseItem = React.memo(function DayExpenseItem({
  expense,
  onDelete,
  onEdit,
}: DayExpenseItemProps) {
  const categoryInfo = getCategoryInfo(expense.category)
  const paymentMethodDisplay = formatPaymentMethodDisplay(expense.paymentMethod)

  return (
    <ExpenseCard>
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
          {paymentMethodDisplay && (
            <Text color="$color" opacity={0.5} fontSize="$2">
              {paymentMethodDisplay}
            </Text>
          )}
        </YStack>
      </XStack>

      <XStack gap="$3" style={layoutStyles.actionButtons}>
        <AmountText type="expense">-₹{expense.amount.toFixed(2)}</AmountText>
        <Button
          size="$2"
          icon={Edit3}
          chromeless
          onPress={() => onEdit(expense)}
          aria-label="Edit"
        />
        <Button
          size="$2"
          icon={Trash}
          chromeless
          onPress={() => onDelete(expense.id)}
          aria-label="Delete"
        />
      </XStack>
    </ExpenseCard>
  )
})

export default function DayExpensesScreen() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const { state, deleteExpense, editExpense } = useExpenses()

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Filter expenses for this date
  const dayExpenses = React.useMemo(() => {
    if (!date) return []
    return state.expenses.filter((expense) => {
      // Assuming date param is YYYY-MM-DD
      const expenseDate = expense.date.split("T")[0]
      return expenseDate === date
    })
  }, [state.expenses, date])

  // Memoized delete handler
  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Expense", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteExpense(id) },
      ])
    },
    [deleteExpense]
  )

  // Memoized edit handler - opens the edit modal
  const handleEdit = useCallback((expense: Expense) => {
    setEditingExpense(expense)
    setIsEditModalOpen(true)
  }, [])

  // Handle save from edit modal - calls editExpense action
  const handleSaveEdit = useCallback(
    (id: string, updates: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
      editExpense(id, updates)
      setIsEditModalOpen(false)
      setEditingExpense(null)
    },
    [editExpense]
  )

  // Handle close edit modal
  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false)
    setEditingExpense(null)
  }, [])

  // Format date for display: dd/MM/yyyy
  const formattedDisplayDate = React.useMemo(
    () => (date ? format(parseISO(date), "dd/MM/yyyy") : "Invalid Date"),
    [date]
  )

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: formattedDisplayDate, headerBackTitle: "Back" }} />

      <SectionHeader>Transactions for {formattedDisplayDate}</SectionHeader>

      {dayExpenses.length === 0 ? (
        <Text color="$color" opacity={0.6} style={layoutStyles.emptyText}>
          No expenses found for this date.
        </Text>
      ) : (
        dayExpenses.map((expense) => (
          <DayExpenseItem
            key={expense.id}
            expense={expense}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          open={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveEdit}
        />
      )}
    </ScreenContainer>
  )
}
