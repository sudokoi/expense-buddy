import { useState, useMemo, useCallback } from "react"
import { View, Text } from "react-native"
import { Keyboard } from "react-native"
import { Check } from "lucide-react-native"
import { Label } from "./Label"
import { Input } from "./Input"
import { Button } from "./Button"
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
import { useCategories, useSettings } from "../../stores/hooks"
import { isPaymentInstrumentMethod } from "../../services/payment-instruments"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { getCurrencySymbol, getFallbackCurrency } from "../../utils/currency"
import { UI_OPACITY, UI_FONT_WEIGHT, UI_BORDER_WIDTH } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []
import { PaymentInstrumentMethod } from "../../types/payment-instrument"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "./PaymentInstrumentInlineDropdown"
import { AppSheetScaffold } from "./AppSheetScaffold"

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
  const theme = useThemeColors()
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
        snapPoints={[100]}
        scroll
      >
        <View className="gap-4 pb-5">
          {/* Amount Input */}
          <View className="gap-2">
            <Label style={{ opacity: UI_OPACITY.strong }}>
              {t("history.editDialog.fields.amount")}
            </Label>
            <View className="flex-row items-center gap-2">
              <Text
                className="text-sm text-foreground"
                style={{ fontWeight: UI_FONT_WEIGHT.bold, opacity: UI_OPACITY.strong }}
              >
                {getCurrencySymbol(expense.currency || getFallbackCurrency())}
              </Text>
              <Input
                className={`flex-1 ${errors.amount ? "border-error" : ""}`}
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
                style={{
                  borderWidth: UI_BORDER_WIDTH.normal,
                  borderColor: errors.amount ? undefined : theme.border,
                }}
                placeholderTextColor={theme.foreground}
                accessibilityLabel={t("history.editDialog.fields.amount")}
              />
            </View>
            {errors.amount && <Text className="text-xs text-error">{errors.amount}</Text>}
          </View>

          {/* Category Selection */}
          <View className="gap-2">
            <Label style={{ opacity: UI_OPACITY.strong }}>
              {t("history.editDialog.fields.category")}
            </Label>
            <View className="flex-row flex-wrap gap-2">
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
            </View>
          </View>

          {/* Note Input */}
          <View className="gap-2">
            <Label style={{ opacity: UI_OPACITY.strong }}>
              {t("history.editDialog.fields.note")}
            </Label>
            <Input
              placeholder={t("history.editDialog.fields.notePlaceholder")}
              value={note}
              onChangeText={setNote}
              style={{
                borderWidth: UI_BORDER_WIDTH.normal,
                borderColor: theme.border,
              }}
              placeholderTextColor={theme.foreground}
              accessibilityLabel={t("history.editDialog.fields.note")}
            />
          </View>

          {/* Payment Method Selection */}
          <View className="gap-2">
            <Label style={{ opacity: UI_OPACITY.strong }}>
              {t("history.editDialog.fields.paymentMethod")}
            </Label>
            <View className="flex-row flex-wrap gap-2">
              {PAYMENT_METHODS.map((pm) => (
                <PaymentMethodCard
                  key={pm.value}
                  config={pm}
                  isSelected={paymentMethodType === pm.value}
                  onPress={() => handlePaymentMethodSelect(pm.value)}
                />
              ))}
            </View>

            {/* Identifier input for cards/UPI/Other */}
            {selectedPaymentConfig?.hasIdentifier && (
              <View className="mt-2 gap-1">
                <Label className="text-xs" style={{ opacity: UI_OPACITY.subtle }}>
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
                    style={{
                      borderWidth: UI_BORDER_WIDTH.normal,
                      borderColor: theme.border,
                    }}
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
                    placeholderTextColor={theme.foreground}
                  />
                )}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="mt-2 flex-row justify-end gap-3">
            <Button size="control" variant="ghost" onPress={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="control"
              variant="accent"
              className="gap-2"
              onPress={handleSave}
            >
              <Check size={16} color={theme.accentForeground} />
              {t("common.save")}
            </Button>
          </View>
        </View>
      </AppSheetScaffold>
    </>
  )
}

export type { EditExpenseModalProps }
