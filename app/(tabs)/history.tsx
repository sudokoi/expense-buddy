
import React from 'react'
import { YStack, Text, ScrollView, XStack, H4, Button, Card, Separator, useTheme, H6, Spacer } from 'tamagui'
import { Alert, SectionList } from 'react-native'
import { useExpenses } from '../../context/ExpenseContext'
import { CATEGORIES } from '../../constants/categories'
import { Trash } from '@tamagui/lucide-icons'
import { format, parseISO } from 'date-fns'

export default function HistoryScreen() {
  const { state, deleteExpense } = useExpenses()
  const theme = useTheme()

  const groupedExpenses = React.useMemo(() => {
    const grouped: { title: string; data: typeof state.expenses }[] = []
    const sorted = [...state.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    sorted.forEach((expense) => {
      const dateKey = format(parseISO(expense.date), 'MMMM dd, yyyy')
      const existing = grouped.find((g) => g.title === dateKey)
      if (existing) {
        existing.data.push(expense)
      } else {
        grouped.push({ title: dateKey, data: [expense] })
      }
    })
    return grouped
  }, [state.expenses])

  const handleDelete = (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) },
    ])
  }

  const getCategoryIcon = (catValue: string) => {
    const cat = CATEGORIES.find((c) => c.value === catValue)
    return cat ? { color: cat.color, label: cat.label } : { color: (theme.gray10?.val as string) || 'gray', label: 'Other' }
  }

  if (state.expenses.length === 0) {
    return (
      <YStack flex={1} style={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 24, color: (theme.gray10?.val as string) || 'gray' }}>
          No expenses yet.
        </Text>
        <Text style={{ fontSize: 16, color: (theme.gray8?.val as string) || 'gray', marginTop: 8 }}>
          Add one from the + tab.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} style={{ backgroundColor: (theme.background?.val as string) || 'white', paddingHorizontal: 16, paddingTop: 16 }}>
      <H4 style={{ marginBottom: 16 }}>Expense History</H4>
      <SectionList
        sections={groupedExpenses}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <YStack style={{ backgroundColor: (theme.background?.val as string) || 'white', paddingVertical: 8 }}>
            <H6 style={{ color: (theme.gray11?.val as string) || 'gray' }}>{title}</H6>
          </YStack>
        )}
        renderItem={({ item }) => {
          const categoryInfo = getCategoryIcon(item.category)
          return (
            <Card
              bordered
              style={{
                marginBottom: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              animation="lazy"
              hoverStyle={{ scale: 1.01 }}
            >
              <XStack flex={1} style={{ gap: 12, alignItems: 'center' }}>
                <YStack
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 16,
                    backgroundColor: categoryInfo.color,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ fontSize: 20 }}>
                    {/* Placeholder for real icon if needed, or first letter */}
                    {categoryInfo.label[0]}
                  </Text>
                </YStack>
                <YStack flex={1}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                    {item.note || categoryInfo.label}
                  </Text>
                  <Text style={{ color: (theme.gray10?.val as string) || 'gray', fontSize: 12 }}>
                    {format(parseISO(item.date), 'h:mm a')} • {item.category}
                  </Text>
                </YStack>
              </XStack>

              <XStack style={{ alignItems: 'center', gap: 12 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: (theme.red10?.val as string) || 'red' }}>
                  -₹{item.amount.toFixed(2)}
                </Text>
                <Button
                  size="$2"
                  icon={Trash}
                  chromeless
                  onPress={() => handleDelete(item.id)}
                  aria-label="Delete"
                />
              </XStack>
            </Card>
          )
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </YStack>
  )
}
