import { useState, useMemo, useCallback } from "react"
import { YStack, XStack, Text, Input, Button, TextArea, Label } from "tamagui"
import { ViewStyle, Keyboard } from "react-native"
import { Check } from "@tamagui/lucide-icons"
import {
  Expense,
  ExpenseCategory,
  PaymentMethodType,
  PaymentMethod,
} from "../../types/expense"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { validateExpenseForm } from "../../utils/expense-validation"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { CategoryCard } from "./CategoryCard"
import { PaymentMethodCard } from "./PaymentMethodCard"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { useCategories, useSettings } from "../../stores/hooks"
import { isPaymentInstrumentMethod } from "../../services/payment-instruments"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { getCurrencySymbol, getFallbackCurrency } from "../../utils/currency"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []
import { PaymentInstrumentMethod } from "../../types/payment-instrument"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "./PaymentInstrumentInlineDropdown"
import { AppSheetScaffold } from "./AppSheetScaffold"

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
  const { t } = useTranslation()
  const { settings, updateSettings } = useSettings()

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS

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
  const [paymentInstrumentId, setPaymentInstrumentId] = useState<string | undefined>(
    expense.paymentMethod?.instrumentId
  )

  const [instrumentEntryKind, setInstrumentEntryKind] = useState<InstrumentEntryKind>(
    expense.paymentMethod?.instrumentId
      ? "saved"
      : expense.paymentMethod?.identifier
        ? "manual"
        : "none"
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
        setPaymentInstrumentId(undefined)
        setInstrumentEntryKind("none")
      } else {
        setPaymentMethodType(type)
        setPaymentMethodId("") // Clear identifier when changing type
        setPaymentInstrumentId(undefined)
        setInstrumentEntryKind("none")
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
        setPaymentInstrumentId(undefined)
        if (paymentMethodType && isPaymentInstrumentMethod(paymentMethodType)) {
          setInstrumentEntryKind("manual")
        }
      }
    },
    [selectedPaymentConfig, paymentMethodType]
  )

  // Handle save with Zod validation (same as add flow)
  const handleSave = useCallback(() => {
    // Dismiss keyboard to ensure button press is captured on first tap
    Keyboard.dismiss()

    // Validate with Zod schema (same validation as add flow)
    const validation = validateExpenseForm(
      {
        amount,
        category,
        note,
        paymentMethodType,
        paymentMethodId,
      },
      t
    )

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
          instrumentId: paymentInstrumentId,
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
    paymentInstrumentId,
    expense.id,
    expense.date,
    onSave,
    onClose,
    t,
  ])

  // Handle close - reset form to original values
  const handleClose = useCallback(() => {
    setAmount(expense.amount.toString())
    setCategory(expense.category)
    setNote(expense.note || "")
    setPaymentMethodType(expense.paymentMethod?.type)
    setPaymentMethodId(expense.paymentMethod?.identifier || "")
    setPaymentInstrumentId(expense.paymentMethod?.instrumentId)
    setInstrumentEntryKind(
      expense.paymentMethod?.instrumentId
        ? "saved"
        : expense.paymentMethod?.identifier
          ? "manual"
          : "none"
    )
    setErrors({})
    onClose()
  }, [expense, onClose])

  return (
    <>
      <AppSheetScaffold
        open={open}
        onClose={handleClose}
        title={t("history.editDialog.title")}
        snapPoints={[95]}
        scroll
      >
        <YStack gap="$4" pb="$6">
          {/* Amount Input */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              {t("history.editDialog.fields.amount")}
            </Label>
            <XStack style={{ alignItems: "center" }} gap="$2">
              <Text fontSize="$4" fontWeight="bold" color="$color" opacity={0.8}>
                {getCurrencySymbol(expense.currency || getFallbackCurrency())}
              </Text>
              <Input
                flex={1}
                size="$4"
                placeholder={t("add.amountPlaceholder")}
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
            </XStack>
            {errors.amount && (
              <Text fontSize="$2" color="$red10">
                {errors.amount}
              </Text>
            )}
          </YStack>

          {/* Category Selection */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              {t("history.editDialog.fields.category")}
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
              {t("history.editDialog.fields.note")}
            </Label>
            <TextArea
              placeholder={t("history.editDialog.fields.notePlaceholder")}
              value={note}
              onChangeText={setNote}
              numberOfLines={2}
            />
          </YStack>

          {/* Payment Method Selection */}
          <YStack gap="$2">
            <Label color="$color" opacity={0.8}>
              {t("history.editDialog.fields.paymentMethod")}
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
                  {selectedPaymentConfig.identifierLabel} {t("common.optional")}
                </Label>

                {paymentMethodType && isPaymentInstrumentMethod(paymentMethodType) ? (
                  <PaymentInstrumentInlineDropdown
                    method={paymentMethodType as PaymentInstrumentMethod}
                    instruments={allInstruments}
                    kind={
                      paymentInstrumentId
                        ? "saved"
                        : instrumentEntryKind === "manual"
                          ? "manual"
                          : "none"
                    }
                    selectedInstrumentId={paymentInstrumentId}
                    manualDigits={paymentMethodId}
                    identifierLabel={selectedPaymentConfig.identifierLabel}
                    maxLength={selectedPaymentConfig.maxLength}
                    onChange={(next) => {
                      setInstrumentEntryKind(next.kind)
                      setPaymentInstrumentId(next.selectedInstrumentId)
                      setPaymentMethodId(next.manualDigits)
                    }}
                    onCreateInstrument={(inst) => {
                      updateSettings({
                        paymentInstruments: [inst, ...allInstruments],
                      })
                    }}
                  />
                ) : (
                  <Input
                    size="$4"
                    placeholder={
                      paymentMethodType === "Other"
                        ? t("history.editDialog.fields.otherPlaceholder")
                        : t("history.editDialog.fields.identifierPlaceholder", {
                            max: selectedPaymentConfig.maxLength,
                          })
                    }
                    keyboardType={paymentMethodType === "Other" ? "default" : "numeric"}
                    value={paymentMethodId}
                    onChangeText={handleIdentifierChange}
                    maxLength={selectedPaymentConfig.maxLength}
                  />
                )}
              </YStack>
            )}
          </YStack>

          {/* Action Buttons */}
          <XStack style={layoutStyles.buttonRow}>
            <Button size="$4" chromeless onPress={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="$4"
              themeInverse
              onPress={handleSave}
              icon={<Check size="$1" />}
              fontWeight="bold"
            >
              {t("common.save")}
            </Button>
          </XStack>
        </YStack>
      </AppSheetScaffold>
    </>
  )
}

export type { EditExpenseModalProps }
