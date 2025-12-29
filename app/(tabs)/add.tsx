import { useState, useMemo } from "react"
import { YStack, XStack, Text, Input, Button, TextArea, H4, Label } from "tamagui"
import { useRouter, Href } from "expo-router"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useExpenses } from "../../context/ExpenseContext"
import { CATEGORIES } from "../../constants/categories"
import { ExpenseCategory } from "../../types/expense"
import { Calendar, Check } from "@tamagui/lucide-icons"
import { Alert, ViewStyle, TextStyle } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  parseExpression,
  hasOperators,
  formatAmount,
} from "../../utils/expression-parser"
import { CategoryCard } from "../../components/ui"
import { ACCENT_COLORS } from "../../constants/theme-colors"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  container: {
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  } as ViewStyle,
  header: {
    textAlign: "center",
    marginBottom: 8,
  } as TextStyle,
  amountRow: {
    alignItems: "center",
  } as ViewStyle,
  categoryRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  saveButton: {
    marginTop: 16,
  } as ViewStyle,
}

export default function AddExpenseScreen() {
  const router = useRouter()
  const { addExpense } = useExpenses()
  const insets = useSafeAreaInsets()

  // Theme colors - extract raw values for components that need them

  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Food")
  const [date, setDate] = useState(new Date())
  const [note, setNote] = useState("")
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Compute preview when expression contains operators
  const expressionPreview = useMemo(() => {
    if (!amount.trim() || !hasOperators(amount)) {
      return null
    }
    const result = parseExpression(amount)
    if (result.success && result.value !== undefined) {
      return formatAmount(result.value)
    }
    return null
  }, [amount])

  const handleSave = () => {
    if (!amount.trim()) {
      Alert.alert("Invalid Amount", "Please enter a valid amount")
      return
    }

    // Parse the expression
    const result = parseExpression(amount)

    if (!result.success) {
      Alert.alert("Invalid Expression", result.error || "Please enter a valid expression")
      return
    }

    addExpense({
      amount: result.value!,
      category,
      date: date.toISOString(),
      note,
    })

    // Reset and go back or to history
    setAmount("")
    setNote("")
    router.push("/(tabs)/history" as Href)
  }

  const onChangeDate = (_event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date
    setShowDatePicker(false)
    setDate(currentDate)
  }

  return (
    <YStack flex={1} bg="$background">
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom }}
        bottomOffset={50}
      >
        <YStack gap="$3" style={layoutStyles.container}>
          <H4 style={layoutStyles.header}>Add New Expense</H4>

          {/* Amount Input */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Amount
            </Label>
            <XStack style={layoutStyles.amountRow}>
              <Input
                flex={1}
                size="$5"
                placeholder="0.00 or 100+50"
                keyboardType="default"
                value={amount}
                onChangeText={setAmount}
                borderWidth={2}
                borderColor="$borderColor"
                focusStyle={{ borderColor: ACCENT_COLORS.primary }}
              />
            </XStack>
            {expressionPreview && (
              <Text fontSize="$3" color="$color" opacity={0.7}>
                = ₹{expressionPreview}
              </Text>
            )}
          </YStack>

          {/* Category Selection */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Category
            </Label>
            <XStack style={layoutStyles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.value
                return (
                  <CategoryCard
                    key={cat.value}
                    isSelected={isSelected}
                    categoryColor={cat.color}
                    label={cat.label}
                    onPress={() => setCategory(cat.value)}
                    compact
                  />
                )
              })}
            </XStack>
          </YStack>

          {/* Date Picker */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Date
            </Label>
            <Button
              icon={<Calendar size="$1" />}
              size="$4"
              onPress={() => setShowDatePicker(true)}
              chromeless
              borderWidth={1}
            >
              {date.toLocaleDateString()}
            </Button>
            {showDatePicker && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode="date"
                display="default"
                onChange={onChangeDate}
              />
            )}
          </YStack>

          {/* Note Input */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Note (Optional)
            </Label>
            <TextArea
              placeholder="What was this for?"
              value={note}
              onChangeText={setNote}
              numberOfLines={2}
            />
          </YStack>

          {/* Save Button */}
          <Button
            style={layoutStyles.saveButton}
            size="$4"
            themeInverse
            onPress={handleSave}
            icon={<Check size="$1" />}
            fontWeight="bold"
          >
            Save Expense
          </Button>
        </YStack>
      </KeyboardAwareScrollView>
    </YStack>
  )
}
