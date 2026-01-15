import React, { useState, useCallback } from "react"
import { useLocalSearchParams, Stack } from "expo-router"
import { YStack, Text } from "tamagui"
import { useExpenses, useCategories, useSettings } from "../../stores/hooks"
import { format, parseISO } from "date-fns"
import { Alert, FlatList, ViewStyle, TextStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { EditExpenseModal } from "../../components/ui/EditExpenseModal"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import { CATEGORY_COLORS } from "../../constants/category-colors"

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
  const { state, deleteExpense, editExpense } = useExpenses()
  const { categories } = useCategories()
  const { settings } = useSettings()
  const insets = useSafeAreaInsets()

  const instruments = React.useMemo(
    () => settings.paymentInstruments ?? [],
    [settings.paymentInstruments]
  )

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Filter expenses for this date (using activeExpenses to exclude soft-deleted)
  const dayExpenses = React.useMemo(() => {
    if (!date) return []
    return state.activeExpenses.filter((expense) => {
      // Assuming date param is YYYY-MM-DD
      const expenseDate = expense.date.split("T")[0]
      return expenseDate === date
    })
  }, [state.activeExpenses, date])

  const categoryByLabel = React.useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) {
      map.set(category.label, category)
    }
    return map
  }, [categories])

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

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => {
      const categoryInfo =
        categoryByLabel.get(item.category) ??
        ({
          label: item.category,
          icon: "Circle",
          color: CATEGORY_COLORS.Other,
        } satisfies Pick<Category, "label" | "icon" | "color">)

      return (
        <ExpenseRow
          expense={item}
          categoryInfo={categoryInfo}
          instruments={instruments}
          subtitleMode="time"
          showActions
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )
    },
    [categoryByLabel, handleDelete, handleEdit, instruments]
  )

  const keyExtractor = useCallback((item: Expense) => item.id, [])

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen options={{ title: formattedDisplayDate, headerBackTitle: "Back" }} />

      <FlatList
        data={dayExpenses}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom,
        }}
        ListHeaderComponent={
          <SectionHeader>Transactions for {formattedDisplayDate}</SectionHeader>
        }
        ListEmptyComponent={
          <Text color="$color" opacity={0.6} style={layoutStyles.emptyText}>
            No expenses found for this date.
          </Text>
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={10}
        removeClippedSubviews
      />

      {/* Edit Expense Modal */}
      {editingExpense && (
        <EditExpenseModal
          key={editingExpense.id}
          expense={editingExpense}
          open={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveEdit}
        />
      )}
    </YStack>
  )
}
