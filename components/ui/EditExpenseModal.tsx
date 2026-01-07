import { useState, useMemo, useCallback } from "react"
import { YStack, XStack, Text, Input, Button, TextArea, Label, Sheet, H4 } from "tamagui"
import { ViewStyle, Keyboard } from "react-native"
import { Check, X } from "@tamagui/lucide-icons"
import {
  Expense,
  ExpenseCategory,
  PaymentMethodType,
  PaymentMethod,
} from "../../types/expense"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { validateExpenseForm } from "../../utils/expense-validation"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { CategoryCard } from "./CategoryCard"
import { PaymentMethodCard } from "./PaymentMethodCard"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { useCategories } from "../../stores"

// Layout styles that Tamagui's type system doesn't support as direct props
const layoutStyles = {
  categoryRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  paymentMethodRow: {
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,
  buttonRow: {
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  sheetFrame: {
    padding: 16,
  } as ViewStyle,
  contentContainer: {
    marginTop: 8,
  } as ViewStyle,
  identifierContainer: {
    marginTop: 8,
  } as ViewStyle,
}

interface EditExpenseModalProps {
  expense: Expense
  open: boolean
  onClose: () => void
  onSave: (id: string, updates: Omit<Expense, "id" | "createdAt" | "updatedAt">) => void
}

/**
 * EditExpenseModal - Modal for editing an existing expense
 * Pre-populates all fields from the existing expense
 * Uses the same Zod validation as the add flow
 */
export function EditExpenseModal({
  expense,
  open,
  onClose,
  onSave,
}: EditExpenseModalProps) {
  // Get categories from store (sorted by order)
  const { categories } = useCategories()

  // Form state - pre-populated from expense
  const [amount, setAmount] = useState(expense.amount.toString())
  const [category, setCategory] = useState<ExpenseCategory>(expense.category)
  const [note, setNote] = useState(expense.note || "")
  const [paymentMethodType, setPaymentMethodType] = useState<
    PaymentMethodType | undefined
  >(expense.paymentMethod?.type)
  const [paymentMethodId, setPaymentMethodId] = useState(
    expense.paymentMethod?.identifier || ""
  )

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get config for selected payment method
  const selectedPaymentConfig = useMemo(() => {
    if (!paymentMethodType) return null
    return PAYMENT_METHODS.find((pm) => pm.value === paymentMethodType) || null
  }, [paymentMethodType])

  // Memoized category selection handler
  const handleCategorySelect = useCallback((value: ExpenseCategory) => {
    setCategory(value)
  }, [])

  // Handle payment method type change - clear identifier when type changes
  const handlePaymentMethodSelect = useCallback(
    (type: PaymentMethodType) => {
      if (paymentMethodType === type) {
        // Deselect if already selected
        setPaymentMethodType(undefined)
        setPaymentMethodId("")
      } else {
        setPaymentMethodType(type)
        setPaymentMethodId("") // Clear identifier when changing type
      }
    },
    [paymentMethodType]
  )

  // Validate and set identifier using the same validation as add flow
  const handleIdentifierChange = useCallback(
    (text: string) => {
      // For "Other" payment method, allow any text (description)
      // For other payment methods, use the validated identifier utility function
      if (paymentMethodType === "Other") {
        const maxLen = selectedPaymentConfig?.maxLength || 50
        setPaymentMethodId(text.slice(0, maxLen))
      } else {
        const maxLen = selectedPaymentConfig?.maxLength || 4
        setPaymentMethodId(validateIdentifier(text, maxLen))
      }
    },
    [selectedPaymentConfig, paymentMethodType]
  )

  // Handle save with Zod validation (same as add flow)
  const handleSave = useCallback(() => {
    // Dismiss keyboard to ensure button press is captured on first tap
    Keyboard.dismiss()

    // Validate with Zod schema (same validation as add flow)
    const validation = validateExpenseForm({
      amount,
      category,
      note,
      paymentMethodType,
      paymentMethodId,
    })

    if (!validation.success) {
      setErrors(validation.errors)
      return // Don't close modal, keep user's input for correction
    }

    // Clear errors on successful validation
    setErrors({})

    // Build payment method object if type is selected
    const paymentMethod: PaymentMethod | undefined = paymentMethodType
      ? {
          type: paymentMethodType,
          identifier: paymentMethodId.trim() || undefined,
        }
      : undefined

    onSave(expense.id, {
      amount: parseFloat(amount),
      category,
      date: expense.date,
      note,
      paymentMethod,
    })
    onClose()
  }, [
    amount,
    category,
    note,
    paymentMethodType,
    paymentMethodId,
    expense.id,
    expense.date,
    onSave,
    onClose,
  ])

  // Handle close - reset form to original values
  const handleClose = useCallback(() => {
    setAmount(expense.amount.toString())
    setCategory(expense.category)
    setNote(expense.note || "")
    setPaymentMethodType(expense.paymentMethod?.type)
    setPaymentMethodId(expense.paymentMethod?.identifier || "")
    setErrors({})
    onClose()
  }, [expense, onClose])

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) handleClose()
      }}
      snapPoints={[85]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack gap="$4" style={layoutStyles.contentContainer}>
          <XStack style={layoutStyles.headerRow}>
            <H4>Edit Expense</H4>
            <Button
              size="$3"
              chromeless
              icon={X}
              onPress={handleClose}
              aria-label="Close"
            />
          </XStack>

          {/* Amount Input */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Amount
            </Label>
            <Input
              size="$4"
              placeholder="0.00"
              keyboardType="numeric"
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
            {errors.amount && (
              <Text fontSize="$2" color="$red10">
                {errors.amount}
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

          {/* Payment Method Selection */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              Payment Method (Optional)
            </Label>
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

            {/* Identifier input for cards/UPI/Other */}
            {selectedPaymentConfig?.hasIdentifier && (
              <YStack gap="$1" style={layoutStyles.identifierContainer}>
                <Label color="$color" opacity={0.6} fontSize="$2">
                  {selectedPaymentConfig.identifierLabel} (Optional)
                </Label>
                <Input
                  size="$4"
                  placeholder={
                    paymentMethodType === "Other"
                      ? "e.g., Venmo, PayPal, Gift Card"
                      : `Enter ${selectedPaymentConfig.maxLength} digits`
                  }
                  keyboardType={paymentMethodType === "Other" ? "default" : "numeric"}
                  value={paymentMethodId}
                  onChangeText={handleIdentifierChange}
                  maxLength={selectedPaymentConfig.maxLength}
                />
              </YStack>
            )}
          </YStack>

          {/* Action Buttons */}
          <XStack style={layoutStyles.buttonRow}>
            <Button size="$4" chromeless onPress={handleClose}>
              Cancel
            </Button>
            <Button
              size="$4"
              themeInverse
              onPress={handleSave}
              icon={<Check size="$1" />}
              fontWeight="bold"
            >
              Save Changes
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export type { EditExpenseModalProps }
