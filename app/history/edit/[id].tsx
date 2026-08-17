import { useState, useMemo, useCallback, useEffect } from "react"
import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import { Platform, Text, View } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { parseISO } from "date-fns"
import { Calendar } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import {
  useExpenses,
  useNotifications,
  useSettings,
  useCategories,
} from "../../../stores/hooks"
import { ScreenContainer } from "../../../components/ui/ScreenContainer"
import { CategoryCard } from "../../../components/ui/CategoryCard"
import { PaymentMethodCard } from "../../../components/ui/PaymentMethodCard"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Label } from "../../../components/ui/Label"
import { PAYMENT_METHODS } from "../../../constants/payment-methods"
import { getCurrencySymbol, getFallbackCurrency } from "../../../utils/currency"
import { formatDate } from "../../../utils/date"
import {
  getAmountInputProps,
  getAmountPreview,
  parseAmountInput,
} from "../../../utils/amount-input"
import { validateIdentifier } from "../../../utils/payment-method-validation"
import { isPaymentInstrumentMethod } from "../../../services/payment-instruments"
import type {
  ExpenseCategory,
  PaymentMethodType,
  PaymentMethod,
} from "../../../types/expense"
import type { PaymentInstrument } from "../../../types/payment-instrument"
import { PaymentInstrumentMethod } from "../../../types/payment-instrument"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "../../../components/ui/PaymentInstrumentInlineDropdown"
import { logAsync } from "../../../services/logger"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const { state, editExpense } = useExpenses()
  const { addNotification } = useNotifications()
  const { settings, updateSettings } = useSettings()
  const { categories } = useCategories()

  const expense = useMemo(
    () => state.expenses.find((e) => e.id === id),
    [id, state.expenses]
  )

  useEffect(() => {
    if (!expense) {
      addNotification(t("history.editDialog.notFound"), "error")
      router.back()
    }
  }, [expense, router, addNotification, t])

  const [amount, setAmount] = useState(expense?.amount.toString() ?? "")
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "Other")
  const [note, setNote] = useState(expense?.note ?? "")
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString())
  const [paymentMethodType, setPaymentMethodType] = useState<
    PaymentMethodType | undefined
  >(expense?.paymentMethod?.type)
  const [paymentMethodId, setPaymentMethodId] = useState(
    expense?.paymentMethod?.identifier ?? ""
  )
  const [paymentInstrumentId, setPaymentInstrumentId] = useState<string | undefined>(
    expense?.paymentMethod?.instrumentId
  )
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [instrumentEntryKind, setInstrumentEntryKind] = useState<InstrumentEntryKind>(
    expense?.paymentMethod?.instrumentId
      ? "saved"
      : expense?.paymentMethod?.identifier
        ? "manual"
        : "none"
  )

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS

  const amountInputProps = useMemo(
    () => getAmountInputProps(settings.enableMathExpressions),
    [settings.enableMathExpressions]
  )

  const expressionPreview = useMemo(
    () =>
      getAmountPreview(amount, {
        allowMathExpressions: settings.enableMathExpressions,
      }),
    [amount, settings.enableMathExpressions]
  )

  const selectedPaymentConfig = useMemo(() => {
    if (!paymentMethodType) return null
    return PAYMENT_METHODS.find((pm) => pm.value === paymentMethodType) || null
  }, [paymentMethodType])

  const handleCategorySelect = useCallback((value: ExpenseCategory) => {
    setCategory(value)
  }, [])

  const handlePaymentMethodSelect = useCallback(
    (type: PaymentMethodType) => {
      if (paymentMethodType === type) {
        setPaymentMethodType(undefined)
        setPaymentMethodId("")
        setPaymentInstrumentId(undefined)
        setInstrumentEntryKind("none")
      } else {
        setPaymentMethodType(type)
        setPaymentMethodId("")
        setPaymentInstrumentId(undefined)
        setInstrumentEntryKind("none")
      }
    },
    [paymentMethodType]
  )

  const handleIdentifierChange = useCallback(
    (text: string) => {
      if (paymentMethodType === "Other") {
        const maxLen = selectedPaymentConfig?.maxLength || 50
        setPaymentMethodId(text.slice(0, maxLen))
      } else {
        const maxLen = selectedPaymentConfig?.maxLength || 4
        if (paymentMethodType && isPaymentInstrumentMethod(paymentMethodType)) {
          setInstrumentEntryKind("manual")
        }
        setPaymentMethodId(validateIdentifier(text, maxLen))
        setPaymentInstrumentId(undefined)
      }
    },
    [selectedPaymentConfig, paymentMethodType]
  )

  const handleSave = useCallback(() => {
    if (!expense) return

    if (!amount.trim()) {
      addNotification(t("history.editDialog.fields.amountError"), "error")
      return
    }

    const result = parseAmountInput(amount, {
      allowMathExpressions: settings.enableMathExpressions,
    })

    if (!result.success) {
      addNotification(
        result.error || t("history.editDialog.fields.expressionError"),
        "error"
      )
      return
    }

    const paymentMethod: PaymentMethod | undefined = paymentMethodType
      ? {
          type: paymentMethodType,
          identifier: paymentMethodId.trim() || undefined,
          instrumentId: paymentInstrumentId,
        }
      : undefined

    editExpense(expense.id, {
      amount: result.value!,
      category,
      date,
      note,
      paymentMethod,
    })
    addNotification(t("history.updated"), "success")
    logAsync("INFO", "UI_ACTION", `EDIT_EXPENSE id=${expense.id}`)
    router.back()
  }, [
    expense,
    amount,
    category,
    date,
    note,
    paymentMethodType,
    paymentMethodId,
    paymentInstrumentId,
    settings.enableMathExpressions,
    t,
    editExpense,
    addNotification,
    router,
  ])

  if (!expense) return null

  return (
    <>
      <Stack.Screen options={{ title: t("history.editDialog.title") }} />

      <ScreenContainer>
        <View className="gap-3">
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Label className="opacity-80">{t("history.editDialog.fields.date")}</Label>
              <Button
                size="control"
                className="gap-2"
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} />
                {date
                  ? formatDate(date, "dd/MM/yyyy")
                  : t("history.editDialog.fields.datePlaceholder")}
              </Button>
            </View>
            {showDatePicker && (
              <>
                <DateTimePicker
                  value={date ? parseISO(date) : new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === "ios")
                    if (selectedDate && event.type !== "dismissed") {
                      const originalDate = date ? parseISO(date) : new Date()
                      selectedDate.setHours(
                        originalDate.getHours(),
                        originalDate.getMinutes(),
                        originalDate.getSeconds(),
                        originalDate.getMilliseconds()
                      )
                      setDate(selectedDate.toISOString())
                    }
                  }}
                />
                {showDatePicker && Platform.OS === "ios" && (
                  <Button size="control" onPress={() => setShowDatePicker(false)}>
                    {t("common.done")}
                  </Button>
                )}
              </>
            )}
          </View>

          <View className="gap-2">
            <Label className="opacity-80">{t("history.editDialog.fields.amount")}</Label>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-bold text-foreground opacity-80">
                {getCurrencySymbol(expense.currency || getFallbackCurrency())}
              </Text>
              <Input
                className="flex-1"
                value={amount}
                onChangeText={setAmount}
                placeholder={
                  settings.enableMathExpressions
                    ? t("history.editDialog.fields.amountPlaceholder")
                    : t("history.editDialog.fields.amountPlaceholderNumeric")
                }
                keyboardType={amountInputProps.keyboardType}
                inputMode={amountInputProps.inputMode}
              />
            </View>
            {expressionPreview && (
              <Text className="text-[13px] text-foreground opacity-70">
                {t("history.editDialog.fields.preview", {
                  amount: expressionPreview,
                })}
              </Text>
            )}
          </View>

          <View className="gap-2">
            <Label className="opacity-80">
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

          <View className="gap-2">
            <Label className="opacity-80">{t("history.editDialog.fields.note")}</Label>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={t("history.editDialog.fields.notePlaceholder")}
              selectTextOnFocus
            />
          </View>

          <View className="gap-2">
            <Label className="opacity-80">
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

            {selectedPaymentConfig?.hasIdentifier && (
              <View className="gap-1 mt-2">
                <Label className="text-xs opacity-60">
                  {selectedPaymentConfig.identifierLabel ||
                    t("history.editDialog.fields.identifier")}
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
              </View>
            )}
          </View>

          <View
            className="flex-row gap-3 justify-end mt-4"
            style={{ paddingBottom: insets.bottom }}
          >
            <Button size="control" onPress={() => router.back()}>
              {t("common.cancel")}
            </Button>
            <Button size="control" variant="accent" onPress={handleSave}>
              {t("common.save")}
            </Button>
          </View>
        </View>
      </ScreenContainer>
    </>
  )
}
