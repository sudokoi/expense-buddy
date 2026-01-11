import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { YStack, XStack, Text, Input, Button, TextArea, H4, Label } from "tamagui"
import { useRouter, Href } from "expo-router"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useExpenses, useSettings, useCategories } from "../../stores/hooks"
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
import { CategoryCard } from "../../components/ui/CategoryCard"
import { PaymentMethodCard } from "../../components/ui/PaymentMethodCard"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { PaymentInstrumentPickerSheet } from "../../components/ui/PaymentInstrumentPickerSheet"
import { PaymentInstrumentFormModal } from "../../components/ui/PaymentInstrumentFormModal"
import {
  findInstrumentById,
  formatPaymentInstrumentLabel,
  isPaymentInstrumentMethod,
} from "../../services/payment-instruments"
import { PaymentInstrumentMethod } from "../../types/payment-instrument"
import type { PaymentInstrument } from "../../types/payment-instrument"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

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
  const {
    settings,
    updateSettings,
    defaultPaymentMethod,
    isLoading: isSettingsLoading,
    paymentMethodSectionExpanded,
    setPaymentMethodExpanded,
  } = useSettings()
  const { categories } = useCategories()
  const insets = useSafeAreaInsets()

  // Track if user has interacted with payment method to prevent overwriting their choice
  const hasUserInteractedRef = useRef(false)

  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Food")
  const [date, setDate] = useState(new Date())
  const [note, setNote] = useState("")
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Track if user has manually selected a category
  const hasUserSelectedCategoryRef = useRef(false)

  // Set default category to first in list when categories load (if user hasn't selected one)
  useEffect(() => {
    if (categories.length > 0 && !hasUserSelectedCategoryRef.current) {
      setCategory(categories[0].label)
    }
  }, [categories])

  // Payment method state - tracks user's explicit selection (after interaction)
  const [paymentMethodType, setPaymentMethodType] = useState<
    PaymentMethodType | undefined
  >(undefined)
  const [paymentMethodId, setPaymentMethodId] = useState("")
  const [paymentInstrumentId, setPaymentInstrumentId] = useState<string | undefined>(
    undefined
  )

  const [instrumentPickerOpen, setInstrumentPickerOpen] = useState(false)
  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false)

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS
  const selectedInstrument = useMemo(
    () => findInstrumentById(allInstruments, paymentInstrumentId),
    [allInstruments, paymentInstrumentId]
  )

  // Validation errors state for field-level error messages
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Derive effective payment method: use user's choice if they've interacted,
  // otherwise use default from settings (once loaded)
  const effectivePaymentMethod = hasUserInteractedRef.current
    ? paymentMethodType
    : isSettingsLoading
      ? undefined
      : defaultPaymentMethod

  // Get current payment method config for identifier input
  const selectedPaymentConfig = useMemo(() => {
    if (!effectivePaymentMethod) return null
    return PAYMENT_METHODS.find((pm) => pm.value === effectivePaymentMethod) || null
  }, [effectivePaymentMethod])

  // Memoized category selection handler to prevent unnecessary re-renders
  const handleCategorySelect = useCallback((value: ExpenseCategory) => {
    hasUserSelectedCategoryRef.current = true
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
    // Mark that user has interacted with payment method selection
    hasUserInteractedRef.current = true

    if (effectivePaymentMethod === type) {
      // Deselect if already selected
      setPaymentMethodType(undefined)
      setPaymentMethodId("")
      setPaymentInstrumentId(undefined)
    } else {
      setPaymentMethodType(type)
      setPaymentMethodId("") // Clear identifier when changing type
      setPaymentInstrumentId(undefined)
    }
  }

  const handleIdentifierChange = (text: string) => {
    // For "Other" payment method, allow any text (description)
    // For other payment methods, use the validated identifier utility function
    if (effectivePaymentMethod === "Other") {
      const maxLen = selectedPaymentConfig?.maxLength || 50
      setPaymentMethodId(text.slice(0, maxLen))
    } else {
      const maxLen = selectedPaymentConfig?.maxLength || 4
      setPaymentMethodId(validateIdentifier(text, maxLen))
      setPaymentInstrumentId(undefined)
    }
  }

  const togglePaymentMethodSection = () => {
    // Use store action to toggle and persist
    setPaymentMethodExpanded(!paymentMethodSectionExpanded)
  }

  const handleSave = () => {
    // Dismiss keyboard to ensure button press is captured on first tap
    Keyboard.dismiss()

    // Validate with Zod schema
    const validation = validateExpenseForm({
      amount,
      category,
      note,
      paymentMethodType: effectivePaymentMethod,
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
    const paymentMethod: PaymentMethod | undefined = effectivePaymentMethod
      ? {
          type: effectivePaymentMethod,
          identifier: paymentMethodId.trim() || undefined,
          instrumentId: paymentInstrumentId,
        }
      : undefined

    addExpense({
      amount: result.value!,
      category,
      date: date.toISOString(),
      note,
      paymentMethod,
    })

    // Reset form and navigate to history
    setAmount("")
    setNote("")
    setErrors({})
    // Reset user interaction flags so defaults can apply again
    hasUserInteractedRef.current = false
    hasUserSelectedCategoryRef.current = false
    setPaymentMethodType(undefined)
    setPaymentMethodId("")
    setPaymentInstrumentId(undefined)
    // Reset category to first in list
    if (categories.length > 0) {
      setCategory(categories[0].label)
    }
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
              {categories.map((cat) => {
                const isSelected = category === cat.label
                return (
                  <CategoryCard
                    key={cat.label}
                    isSelected={isSelected}
                    categoryColor={cat.color}
                    label={cat.label}
                    onPress={() => handleCategorySelect(cat.label)}
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
                {paymentMethodSectionExpanded ? (
                  <ChevronUp size={20} color="$color" opacity={0.6} />
                ) : (
                  <ChevronDown size={20} color="$color" opacity={0.6} />
                )}
              </XStack>
            </Button>

            {paymentMethodSectionExpanded && (
              <YStack gap="$2">
                <XStack style={layoutStyles.paymentMethodRow}>
                  {PAYMENT_METHODS.map((pm) => (
                    <PaymentMethodCard
                      key={pm.value}
                      config={pm}
                      isSelected={effectivePaymentMethod === pm.value}
                      onPress={() => handlePaymentMethodSelect(pm.value)}
                    />
                  ))}
                </XStack>

                {/* Identifier input for cards/UPI/Other */}
                {selectedPaymentConfig?.hasIdentifier && (
                  <YStack gap="$1" style={{ marginTop: 8 }}>
                    <Label color="$color" opacity={0.6} fontSize="$2">
                      {selectedPaymentConfig.identifierLabel} (Optional)
                    </Label>

                    {effectivePaymentMethod &&
                    isPaymentInstrumentMethod(effectivePaymentMethod) ? (
                      <YStack gap="$2">
                        <Button
                          size="$4"
                          chromeless
                          borderWidth={1}
                          borderColor="$borderColor"
                          onPress={() => setInstrumentPickerOpen(true)}
                        >
                          {selectedInstrument && !selectedInstrument.deletedAt
                            ? formatPaymentInstrumentLabel(selectedInstrument)
                            : paymentInstrumentId
                              ? `${effectivePaymentMethod} • Others`
                              : "Select saved instrument (optional)"}
                        </Button>

                        {!paymentInstrumentId && (
                          <Input
                            size="$4"
                            placeholder={`Enter ${selectedPaymentConfig.maxLength} digits`}
                            keyboardType="numeric"
                            value={paymentMethodId}
                            onChangeText={handleIdentifierChange}
                            maxLength={selectedPaymentConfig.maxLength}
                          />
                        )}
                      </YStack>
                    ) : (
                      <Input
                        size="$4"
                        placeholder={
                          effectivePaymentMethod === "Other"
                            ? "e.g., Venmo, PayPal, Gift Card"
                            : `Enter ${selectedPaymentConfig.maxLength} digits`
                        }
                        keyboardType={
                          effectivePaymentMethod === "Other" ? "default" : "numeric"
                        }
                        value={paymentMethodId}
                        onChangeText={handleIdentifierChange}
                        maxLength={selectedPaymentConfig.maxLength}
                      />
                    )}
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

      {effectivePaymentMethod && isPaymentInstrumentMethod(effectivePaymentMethod) && (
        <>
          <PaymentInstrumentPickerSheet
            open={instrumentPickerOpen}
            onClose={() => setInstrumentPickerOpen(false)}
            method={effectivePaymentMethod as PaymentInstrumentMethod}
            instruments={allInstruments}
            selectedInstrumentId={paymentInstrumentId}
            onSelectInstrument={(inst) => {
              setPaymentInstrumentId(inst.id)
              setPaymentMethodId(inst.lastDigits)
              setInstrumentPickerOpen(false)
            }}
            onSelectOthers={() => {
              setPaymentInstrumentId(undefined)
              setPaymentMethodId("")
              setInstrumentPickerOpen(false)
            }}
            onAddNew={() => {
              setInstrumentPickerOpen(false)
              setInstrumentFormOpen(true)
            }}
          />

          <PaymentInstrumentFormModal
            open={instrumentFormOpen}
            onClose={() => setInstrumentFormOpen(false)}
            existingInstruments={allInstruments}
            initialMethod={effectivePaymentMethod as PaymentInstrumentMethod}
            onSave={(inst) => {
              updateSettings({ paymentInstruments: [inst, ...allInstruments] })
              setPaymentInstrumentId(inst.id)
              setPaymentMethodId(inst.lastDigits)
            }}
          />
        </>
      )}
    </YStack>
  )
}
