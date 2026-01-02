import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { YStack, XStack, Text, Input, Button, TextArea, H4, Label } from "tamagui"
import { useRouter, Href } from "expo-router"
import DateTimePicker from "@react-native-community/datetimepicker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useExpenses, useSettings } from "../../stores"
import { CATEGORIES } from "../../constants/categories"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { ExpenseCategory, PaymentMethodType, PaymentMethod } from "../../types/expense"
import { Calendar, Check, ChevronDown, ChevronUp } from "@tamagui/lucide-icons"
import { ViewStyle, TextStyle, Keyboard } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  parseExpression,
  hasOperators,
  formatAmount,
} from "../../utils/expression-parser"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { validateExpenseForm } from "../../utils/expense-validation"
import { CategoryCard, PaymentMethodCard } from "../../components/ui"
import { ACCENT_COLORS } from "../../constants/theme-colors"

// Storage key for payment method section expanded state
const PAYMENT_METHOD_EXPANDED_KEY = "payment_method_section_expanded"

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
  paymentMethodRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  saveButton: {
    marginTop: 16,
  } as ViewStyle,
  expandHeader: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
}

export default function AddExpenseScreen() {
  const router = useRouter()
  const { addExpense } = useExpenses()
  const { defaultPaymentMethod, isLoading: isSettingsLoading } = useSettings()
  const insets = useSafeAreaInsets()

  // Track if default has been applied to avoid re-applying after user interaction
  const hasAppliedDefaultRef = useRef(false)

  // Theme colors - extract raw values for components that need them

  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Food")
  const [date, setDate] = useState(new Date())
  const [note, setNote] = useState("")
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Payment method state - will be set from default when settings load
  const [paymentMethodType, setPaymentMethodType] = useState<
    PaymentMethodType | undefined
  >(undefined)
  const [paymentMethodId, setPaymentMethodId] = useState("")

  // Collapsible state for payment method section - persisted across app launches
  const [isPaymentMethodExpanded, setIsPaymentMethodExpanded] = useState(false)
  const [isExpandedLoaded, setIsExpandedLoaded] = useState(false)

  // Validation errors state for field-level error messages
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Apply default payment method when settings finish loading (only once)
  // Using async wrapper to satisfy lint rule about synchronous setState in effects
  useEffect(() => {
    const applyDefault = async () => {
      if (
        !hasAppliedDefaultRef.current &&
        !isSettingsLoading &&
        defaultPaymentMethod !== undefined
      ) {
        setPaymentMethodType(defaultPaymentMethod)
        hasAppliedDefaultRef.current = true
      }
    }
    applyDefault()
  }, [defaultPaymentMethod, isSettingsLoading])

  // Load expanded state from storage on mount
  useEffect(() => {
    const loadExpandedState = async () => {
      try {
        const stored = await AsyncStorage.getItem(PAYMENT_METHOD_EXPANDED_KEY)
        if (stored !== null) {
          setIsPaymentMethodExpanded(stored === "true")
        }
      } catch {
        // Default to collapsed if loading fails
      }
      setIsExpandedLoaded(true)
    }
    loadExpandedState()
  }, [])

  // Save expanded state to storage when it changes
  useEffect(() => {
    // Only save after initial load to avoid overwriting with default
    if (!isExpandedLoaded) return
    const saveExpandedState = async () => {
      try {
        await AsyncStorage.setItem(
          PAYMENT_METHOD_EXPANDED_KEY,
          isPaymentMethodExpanded ? "true" : "false"
        )
      } catch {
        // Ignore save errors
      }
    }
    saveExpandedState()
  }, [isPaymentMethodExpanded, isExpandedLoaded])

  // Get current payment method config for identifier input
  const selectedPaymentConfig = useMemo(() => {
    if (!paymentMethodType) return null
    return PAYMENT_METHODS.find((pm) => pm.value === paymentMethodType) || null
  }, [paymentMethodType])

  // Memoized category selection handler to prevent unnecessary re-renders
  const handleCategorySelect = useCallback((value: ExpenseCategory) => {
    setCategory(value)
  }, [])

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

  const handlePaymentMethodSelect = (type: PaymentMethodType) => {
    if (paymentMethodType === type) {
      // Deselect if already selected
      setPaymentMethodType(undefined)
      setPaymentMethodId("")
    } else {
      setPaymentMethodType(type)
      setPaymentMethodId("") // Clear identifier when changing type
    }
  }

  const handleIdentifierChange = (text: string) => {
    // Use the validated identifier utility function
    const maxLen = selectedPaymentConfig?.maxLength || 4
    setPaymentMethodId(validateIdentifier(text, maxLen))
  }

  const togglePaymentMethodSection = () => {
    setIsPaymentMethodExpanded((prev) => !prev)
  }

  const handleSave = () => {
    // Dismiss keyboard to ensure button press is captured on first tap
    Keyboard.dismiss()

    // Validate with Zod schema
    const validation = validateExpenseForm({
      amount,
      category,
      note,
      paymentMethodType,
      paymentMethodId,
    })

    if (!validation.success) {
      setErrors(validation.errors)
      return // Don't submit, keep user's input for correction
    }

    // Clear errors on successful validation
    setErrors({})

    // Parse the expression for the final amount value
    const result = parseExpression(amount)

    if (!result.success) {
      setErrors({ amount: result.error || "Please enter a valid expression" })
      return
    }

    // Build payment method object if type is selected
    const paymentMethod: PaymentMethod | undefined = paymentMethodType
      ? {
          type: paymentMethodType,
          identifier: paymentMethodId.trim() || undefined,
        }
      : undefined

    addExpense({
      amount: result.value!,
      category,
      date: date.toISOString(),
      note,
      paymentMethod,
    })

    // Reset and go back or to history
    setAmount("")
    setNote("")
    setErrors({})
    setPaymentMethodType(defaultPaymentMethod)
    setPaymentMethodId("")
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
                onChangeText={(text) => {
                  setAmount(text)
                  // Clear error when user starts typing
                  if (errors.amount) {
                    setErrors((prev) => {
                      const { amount: _, ...rest } = prev
                      return rest
                    })
                  }
                }}
                borderWidth={2}
                borderColor={errors.amount ? "$red10" : "$borderColor"}
                focusStyle={{
                  borderColor: errors.amount ? "$red10" : ACCENT_COLORS.primary,
                }}
              />
            </XStack>
            {errors.amount && (
              <Text fontSize="$2" color="$red10">
                {errors.amount}
              </Text>
            )}
            {expressionPreview && !errors.amount && (
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
                    onPress={() => handleCategorySelect(cat.value)}
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

          {/* Payment Method Selection - Collapsible */}
          <YStack gap="$2">
            <Button
              chromeless
              onPress={togglePaymentMethodSection}
              style={{ paddingHorizontal: 0, paddingVertical: 0 }}
            >
              <XStack flex={1} style={layoutStyles.expandHeader}>
                <Label color="$color" opacity={0.8} pointerEvents="none">
                  Payment Method (Optional)
                </Label>
                {isPaymentMethodExpanded ? (
                  <ChevronUp size={20} color="$color" opacity={0.6} />
                ) : (
                  <ChevronDown size={20} color="$color" opacity={0.6} />
                )}
              </XStack>
            </Button>

            {isPaymentMethodExpanded && (
              <YStack gap="$2">
                <XStack style={layoutStyles.paymentMethodRow}>
                  {PAYMENT_METHODS.map((pm) => (
                    <PaymentMethodCard
                      key={pm.value}
                      config={pm}
                      isSelected={paymentMethodType === pm.value}
                      onPress={() => handlePaymentMethodSelect(pm.value)}
                    />
                  ))}
                </XStack>

                {/* Identifier input for cards/UPI */}
                {selectedPaymentConfig?.hasIdentifier && (
                  <YStack gap="$1" style={{ marginTop: 8 }}>
                    <Label color="$color" opacity={0.6} fontSize="$2">
                      {selectedPaymentConfig.identifierLabel} (Optional)
                    </Label>
                    <Input
                      size="$4"
                      placeholder={`Enter ${selectedPaymentConfig.maxLength} digits`}
                      keyboardType="numeric"
                      value={paymentMethodId}
                      onChangeText={handleIdentifierChange}
                      maxLength={selectedPaymentConfig.maxLength}
                    />
                  </YStack>
                )}
              </YStack>
            )}
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
