import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { useRouter, Href } from "expo-router"
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import {
  useExpenses,
  useSettings,
  useCategories,
  useNotifications,
  useUIState,
} from "../../stores/hooks"
import { useSmsImportReview } from "../../providers/sms-import-review-provider"
import { logAsync } from "../../services/logger"
import { PAYMENT_METHODS, getPaymentMethodI18nKey } from "../../constants/payment-methods"
import { ExpenseCategory, PaymentMethodType, PaymentMethod } from "../../types/expense"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
} from "lucide-react-native"
import { Keyboard, Platform, Text, View } from "react-native"
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller"
import { useTabBarHeight } from "../../hooks/use-tab-bar-height"
import {
  getAmountInputProps,
  getAmountPreview,
  parseAmountInput,
} from "../../utils/amount-input"
import { validateIdentifier } from "../../utils/payment-method-validation"
import { validateExpenseForm } from "../../utils/expense-validation"
import { CategoryCard } from "../../components/ui/CategoryCard"
import { PaymentMethodCard } from "../../components/ui/PaymentMethodCard"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { isPaymentInstrumentMethod } from "../../services/payment-instruments"
import { hapticSelection, hapticSuccess, hapticError } from "../../utils/haptics"
import { PaymentInstrumentMethod } from "../../types/payment-instrument"
import type { PaymentInstrument } from "../../types/payment-instrument"
import {
  InstrumentEntryKind,
  PaymentInstrumentInlineDropdown,
} from "../../components/ui/PaymentInstrumentInlineDropdown"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import { formatDate } from "../../utils/date"
import { useSmsImportActions } from "../../hooks/use-sms-import-actions"
import { UI_SPACE, UI_OPACITY } from "../../constants/ui-tokens"

const EMPTY_INSTRUMENTS: PaymentInstrument[] = []

export default function AddExpenseScreen() {
  const router = useRouter()
  const { addExpense } = useExpenses()
  const { addNotification } = useNotifications()
  const { t } = useTranslation()
  const theme = useThemeColors()
  const {
    settings,
    updateSettings,
    defaultPaymentMethod,
    isLoading: isSettingsLoading,
  } = useSettings()
  const { pendingItems: pendingSmsImportItems } = useSmsImportReview()
  const { paymentMethodSectionExpanded, setPaymentMethodExpanded } = useUIState()
  const { isScanningSmsImports, startSmsImportFromAdd } = useSmsImportActions()
  const { categories } = useCategories()
  const tabBarHeight = useTabBarHeight()
  const [footerHeight, setFooterHeight] = useState(72)
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null)

  // Track if user has interacted with payment method to prevent overwriting their choice
  const hasUserInteractedRef = useRef(false)

  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Food")
  const [date, setDate] = useState(() => new Date())
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

  const [instrumentEntryKind, setInstrumentEntryKind] =
    useState<InstrumentEntryKind>("none")

  const allInstruments = settings.paymentInstruments ?? EMPTY_INSTRUMENTS
  const amountInputProps = useMemo(
    () => getAmountInputProps(settings.enableMathExpressions),
    [settings.enableMathExpressions]
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
    void hapticSelection()
  }, [])

  // Compute preview when expression contains operators
  const expressionPreview = useMemo(() => {
    return getAmountPreview(amount, {
      allowMathExpressions: settings.enableMathExpressions,
    })
  }, [amount, settings.enableMathExpressions])

  const categoryCards = useMemo(
    () =>
      categories.map((cat) => {
        const isSelected = category === cat.label
        return (
          <CategoryCard
            key={cat.label}
            isSelected={isSelected}
            categoryColor={cat.color}
            iconName={cat.icon}
            label={cat.label}
            onPress={() => handleCategorySelect(cat.label)}
            compact
          />
        )
      }),
    [categories, category, handleCategorySelect]
  )

  const handlePaymentMethodSelect = (type: PaymentMethodType) => {
    // Mark that user has interacted with payment method selection
    hasUserInteractedRef.current = true

    if (effectivePaymentMethod === type) {
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
      if (effectivePaymentMethod && isPaymentInstrumentMethod(effectivePaymentMethod)) {
        setInstrumentEntryKind("manual")
      }
    }
  }

  const togglePaymentMethodSection = () => {
    // Use store action to toggle and persist
    setPaymentMethodExpanded(!paymentMethodSectionExpanded)
  }

  const handleOpenSmsImport = useCallback(async () => {
    Keyboard.dismiss()
    await startSmsImportFromAdd()
  }, [startSmsImportFromAdd])

  const resetForm = useCallback(() => {
    setAmount("")
    setNote("")
    setErrors({})
    // Reset user interaction flags so defaults can apply again
    hasUserInteractedRef.current = false
    hasUserSelectedCategoryRef.current = false
    setPaymentMethodType(undefined)
    setPaymentMethodId("")
    setPaymentInstrumentId(undefined)
    setInstrumentEntryKind("none")
    // Reset category to first in list
    if (categories.length > 0) {
      setCategory(categories[0].label)
    }
  }, [categories])

  const handleSave = ({ stayOnAdd }: { stayOnAdd: boolean }) => {
    // Dismiss keyboard to ensure button press is captured on first tap
    Keyboard.dismiss()

    // Validate with Zod schema
    const validation = validateExpenseForm(
      {
        amount,
        category,
        note,
        paymentMethodType: effectivePaymentMethod,
        paymentMethodId,
      },
      t,
      { allowMathExpressions: settings.enableMathExpressions }
    )

    if (!validation.success) {
      setErrors(validation.errors)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
      void hapticError()
      return // Don't submit, keep user's input for correction
    }

    // Clear errors on successful validation
    setErrors({})

    // Parse the expression for the final amount value
    const result = parseAmountInput(amount, {
      allowMathExpressions: settings.enableMathExpressions,
    })

    if (!result.success) {
      setErrors({ amount: result.error || t("add.expressionError") })
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
      currency: settings.defaultCurrency,
      category,
      date: date.toISOString(),
      note,
      paymentMethod,
    })

    void hapticSuccess()
    if (stayOnAdd) {
      addNotification(t("add.successAddAnother"), "success")
    } else {
      addNotification(t("add.success"), "success")
    }
    logAsync("INFO", "UI_ACTION", `ADD_EXPENSE stayOnAdd=${stayOnAdd}`)

    resetForm()
    if (!stayOnAdd) {
      router.push("/(tabs)/history" as Href)
    }
  }

  const onChangeDate = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setDate(selectedDate)
    }
  }, [])

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{
          padding: UI_SPACE.gutter,
        }}
        bottomOffset={footerHeight + UI_SPACE.control}
        extraKeyboardSpace={footerHeight}
        keyboardShouldPersistTaps="handled"
      >
        <View className="max-w-[600px] w-full self-center gap-3">
          {Platform.OS === "android" ? (
            <Button
              size="control"
              variant="outline"
              icon={<Download size={20} />}
              onPress={() => {
                void handleOpenSmsImport()
              }}
              disabled={isScanningSmsImports}
              accessibilityLabel={t("add.importSms")}
            >
              {isScanningSmsImports
                ? t("settings.smsImport.actions.scanning")
                : pendingSmsImportItems.length > 0
                  ? t("add.importSmsWithPending", {
                      count: pendingSmsImportItems.length,
                    })
                  : t("add.importSms")}
            </Button>
          ) : null}

          {/* Amount Input */}
          <View className="gap-2">
            <Label className="opacity-80">{t("add.amount")}</Label>
            <View
              className={`flex-row items-center rounded-control border bg-surface px-3 ${errors.amount ? "border-error" : "border-border"}`}
            >
              <Text className="text-xl font-semibold text-muted-foreground">
                {getCurrencySymbol(settings.defaultCurrency)}
              </Text>
              <Input
                className="min-h-16 flex-1 border-0 bg-transparent text-2xl font-semibold"
                placeholder={
                  settings.enableMathExpressions
                    ? t("add.amountPlaceholder")
                    : t("add.amountPlaceholderNumeric")
                }
                keyboardType={amountInputProps.keyboardType}
                inputMode={amountInputProps.inputMode}
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
                accessibilityLabel={t("add.amount")}
              />
            </View>
            {errors.amount && (
              <Text className="text-xs text-error" accessibilityRole="alert">
                {errors.amount}
              </Text>
            )}
            {expressionPreview && !errors.amount && (
              <Text className="text-[13px] text-foreground opacity-70">
                {t("add.preview", { amount: expressionPreview })}
              </Text>
            )}
          </View>

          {/* Category Selection */}
          <View className="gap-2">
            <Label className="opacity-80">{t("add.category")}</Label>
            <View className="flex-row flex-wrap gap-2">{categoryCards}</View>
          </View>

          {/* Date Picker */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Label className="opacity-80">{t("add.date")}</Label>
              <Button
                size="control"
                icon={<Calendar size={16} />}
                onPress={() => setShowDatePicker(true)}
                accessibilityLabel={t("add.date")}
              >
                {formatDate(date, "PP")}
              </Button>
            </View>
            {showDatePicker && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode="date"
                display="default"
                onChange={onChangeDate}
              />
            )}
          </View>

          {/* Note Input */}
          <View className="gap-2">
            <Label className="opacity-80">{t("add.note")}</Label>
            <Input
              placeholder={t("add.notePlaceholder")}
              value={note}
              onChangeText={setNote}
              accessibilityLabel={t("add.note")}
            />
          </View>

          {/* Payment Method Selection - Collapsible */}
          <View className="gap-2">
            <Button
              variant="ghost"
              onPress={togglePaymentMethodSection}
              style={{ paddingHorizontal: 0, paddingVertical: 0 }}
              accessibilityLabel={t("add.paymentMethod")}
              accessibilityState={{ expanded: paymentMethodSectionExpanded }}
            >
              <View className="flex-1 flex-row items-center justify-between">
                <View className="flex-1 gap-1" pointerEvents="none">
                  <Label>{t("add.paymentMethod")}</Label>
                  {!paymentMethodSectionExpanded && effectivePaymentMethod ? (
                    <Text className="text-sm text-muted-foreground">
                      {t(
                        `paymentMethods.${getPaymentMethodI18nKey(effectivePaymentMethod)}`
                      )}
                    </Text>
                  ) : null}
                </View>
                {paymentMethodSectionExpanded ? (
                  <ChevronUp
                    size={20}
                    color={theme.foreground}
                    style={{ opacity: UI_OPACITY.subtle }}
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    color={theme.foreground}
                    style={{ opacity: UI_OPACITY.subtle }}
                  />
                )}
              </View>
            </Button>

            {paymentMethodSectionExpanded && (
              <View className="gap-2">
                <View className="flex-row flex-wrap gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <PaymentMethodCard
                      key={pm.value}
                      config={pm}
                      isSelected={effectivePaymentMethod === pm.value}
                      onPress={() => handlePaymentMethodSelect(pm.value)}
                    />
                  ))}
                </View>

                {/* Identifier input for cards/UPI/Other */}
                {selectedPaymentConfig?.hasIdentifier && (
                  <View className="gap-1" style={{ marginTop: UI_SPACE.control }}>
                    {effectivePaymentMethod &&
                    isPaymentInstrumentMethod(effectivePaymentMethod) ? (
                      <PaymentInstrumentInlineDropdown
                        method={effectivePaymentMethod as PaymentInstrumentMethod}
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
                          effectivePaymentMethod === "Other"
                            ? t("history.editDialog.fields.otherPlaceholder")
                            : t("history.editDialog.fields.identifierPlaceholder", {
                                max: selectedPaymentConfig.maxLength,
                              })
                        }
                        keyboardType={
                          effectivePaymentMethod === "Other" ? "default" : "numeric"
                        }
                        value={paymentMethodId}
                        onChangeText={handleIdentifierChange}
                        maxLength={selectedPaymentConfig.maxLength}
                        accessibilityLabel={t("history.editDialog.fields.identifier")}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ closed: 0, opened: tabBarHeight }}>
        <View
          className="border-t border-border bg-background px-5 py-2"
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <View className="max-w-[600px] w-full self-center flex-row gap-3">
            <Button
              className="flex-1"
              size="control"
              variant="outline"
              icon={<Plus size={20} />}
              onPress={() => handleSave({ stayOnAdd: true })}
              accessibilityLabel={t("add.saveAndAddAnother")}
            >
              {t("add.saveAndAddAnother")}
            </Button>
            <Button
              className="flex-1"
              size="control"
              variant="accent"
              icon={<Check size={20} />}
              onPress={() => handleSave({ stayOnAdd: false })}
              accessibilityLabel={t("add.save")}
            >
              {t("add.save")}
            </Button>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  )
}
