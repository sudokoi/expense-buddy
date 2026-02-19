/**
 * ReviewQueueModal
 *
 * Modal for reviewing, editing, confirming, or rejecting SMS-imported transactions.
 * Displays parsed transaction details, confidence indicator, category/payment selectors,
 * and action buttons wired to the review queue store.
 */

import { useState, useCallback } from "react"
import { YStack, XStack, Text, Input, Button, Checkbox, Separator, Label } from "tamagui"
import { ViewStyle, TextStyle } from "react-native"
import {
  Check,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  XCircle,
} from "@tamagui/lucide-icons"
import { useTranslation } from "react-i18next"
import { ReviewQueueItem } from "../../../types/sms-import"
import { PaymentMethodType } from "../../../types/expense"
import { PAYMENT_METHODS } from "../../../constants/payment-methods"
import { SEMANTIC_COLORS } from "../../../constants/theme-colors"
import { CategoryCard } from "../CategoryCard"
import { PaymentMethodCard } from "../PaymentMethodCard"
import { AppSheetScaffold } from "../AppSheetScaffold"
import { useCategories } from "../../../stores/hooks"
import { reviewQueueStore } from "../../../stores/review-queue-store"
import { getCurrencySymbol, getFallbackCurrency } from "../../../utils/currency"

const layoutStyles = {
  categoryRow: { flexWrap: "wrap", gap: 8 } as ViewStyle,
  paymentMethodRow: { flexWrap: "wrap", gap: 8 } as ViewStyle,
  actionRow: { justifyContent: "space-between", gap: 8 } as ViewStyle,
  touchTarget: { minHeight: 44 } as ViewStyle,
  confidenceBarOuter: {
    width: 60,
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
  } as ViewStyle,
  amountInput: { width: 100, textAlign: "right" } as TextStyle,
}

interface ReviewQueueModalProps {
  item: ReviewQueueItem | null
  open: boolean
  onClose: () => void
  pendingCount: number
}

function getConfidenceColor(score: number): string {
  if (score >= 0.8) return SEMANTIC_COLORS.success
  if (score >= 0.5) return SEMANTIC_COLORS.warning
  return SEMANTIC_COLORS.error
}

function getConfidenceLabelKey(score: number): string {
  if (score >= 0.8) return "smsImport.reviewQueue.confidenceHigh"
  if (score >= 0.5) return "smsImport.reviewQueue.confidenceMedium"
  return "smsImport.reviewQueue.confidenceLow"
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

export function ReviewQueueModal({
  item,
  open,
  onClose,
  pendingCount,
}: ReviewQueueModalProps) {
  const { t } = useTranslation()
  const { categories } = useCategories()

  const [showRawSms, setShowRawSms] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [category, setCategory] = useState("")
  const [paymentMethodType, setPaymentMethodType] = useState<
    PaymentMethodType | undefined
  >()
  const [note, setNote] = useState("")
  const [amount, setAmount] = useState("")
  const [applyToFuture, setApplyToFuture] = useState(false)

  // Sync form state when item changes
  const [lastItemId, setLastItemId] = useState<string | undefined>()
  if (item?.id !== lastItemId) {
    setLastItemId(item?.id)
    if (item) {
      setCategory(item.suggestedCategory)
      setPaymentMethodType(item.suggestedPaymentMethod)
      setNote(item.parsedTransaction.merchant)
      setAmount(item.parsedTransaction.amount.toString())
      setApplyToFuture(false)
      setIsEditing(false)
      setShowRawSms(false)
    }
  }

  const parsed = item?.parsedTransaction
  const currencySymbol = getCurrencySymbol(parsed?.currency || getFallbackCurrency())
  const confidenceScore = parsed?.confidenceScore ?? 0
  const confidenceColor = getConfidenceColor(confidenceScore)
  const confidenceLabel = t(getConfidenceLabelKey(confidenceScore))
  const formattedDate = formatDate(parsed?.date)
  const confidenceWidth = `${Math.round(confidenceScore * 100)}%`

  const handleCategorySelect = useCallback((value: string) => {
    setCategory(value)
    setIsEditing(true)
  }, [])

  const handlePaymentMethodSelect = useCallback(
    (type: PaymentMethodType) => {
      setPaymentMethodType(paymentMethodType === type ? undefined : type)
      setIsEditing(true)
    },
    [paymentMethodType]
  )

  const handleNoteChange = useCallback((text: string) => {
    setNote(text)
    setIsEditing(true)
  }, [])

  const handleAmountChange = useCallback((text: string) => {
    setAmount(text)
    setIsEditing(true)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!item) return
    reviewQueueStore.trigger.confirmItem({ itemId: item.id, applyToFuture })
    onClose()
  }, [item, applyToFuture, onClose])

  const handleEdit = useCallback(() => {
    if (!item) return
    const parsedAmount = parseFloat(amount)
    reviewQueueStore.trigger.editItem({
      itemId: item.id,
      category,
      paymentMethod: paymentMethodType ?? item.suggestedPaymentMethod,
      note,
      amount: isNaN(parsedAmount) ? item.parsedTransaction.amount : parsedAmount,
      applyToFuture,
    })
    onClose()
  }, [item, category, paymentMethodType, note, amount, applyToFuture, onClose])

  const handleReject = useCallback(() => {
    if (!item) return
    reviewQueueStore.trigger.rejectItem({ itemId: item.id })
    onClose()
  }, [item, onClose])

  const handleConfirmAll = useCallback(() => {
    reviewQueueStore.trigger.confirmAll()
    onClose()
  }, [onClose])

  const handleRejectAll = useCallback(() => {
    reviewQueueStore.trigger.rejectAll()
    onClose()
  }, [onClose])

  const toggleRawSms = useCallback(() => {
    setShowRawSms((prev) => !prev)
  }, [])

  const handleApplyToFutureChange = useCallback((checked: boolean) => {
    setApplyToFuture(checked)
  }, [])

  if (!item || !parsed) return null

  return (
    <AppSheetScaffold
      open={open}
      onClose={onClose}
      title={t("smsImport.reviewQueue.title")}
      subtitle={
        pendingCount > 1
          ? t("smsImport.reviewQueue.pendingCount", { count: pendingCount })
          : undefined
      }
      snapPoints={[90]}
      scroll
    >
      <YStack gap="$4" pb="$6">
        {/* Transaction Details */}
        <YStack gap="$3" bg="$backgroundFocus" p="$3" rounded="$3">
          <XStack justify="space-between" items="center">
            <Text fontSize="$3" color="$color" opacity={0.7}>
              {t("smsImport.reviewQueue.amount")}
            </Text>
            <XStack items="center" gap="$1">
              <Text fontSize="$3" color="$color" opacity={0.7}>
                {currencySymbol}
              </Text>
              {isEditing ? (
                <Input
                  size="$3"
                  style={layoutStyles.amountInput}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={handleAmountChange}
                  borderWidth={1}
                  borderColor="$borderColor"
                  aria-label={t("smsImport.reviewQueue.amount")}
                />
              ) : (
                <Text fontSize="$6" fontWeight="bold" color="$color">
                  {parsed.amount.toFixed(2)}
                </Text>
              )}
            </XStack>
          </XStack>

          <XStack justify="space-between" items="center">
            <Text fontSize="$3" color="$color" opacity={0.7}>
              {t("smsImport.reviewQueue.merchant")}
            </Text>
            <Text fontSize="$4" fontWeight="600" color="$color">
              {parsed.merchant}
            </Text>
          </XStack>

          <XStack justify="space-between" items="center">
            <Text fontSize="$3" color="$color" opacity={0.7}>
              {t("smsImport.reviewQueue.date")}
            </Text>
            <Text fontSize="$3" color="$color">
              {formattedDate}
            </Text>
          </XStack>

          {/* Confidence Indicator */}
          <XStack justify="space-between" items="center">
            <Text fontSize="$3" color="$color" opacity={0.7}>
              {t("smsImport.reviewQueue.confidence")}
            </Text>
            <XStack items="center" gap="$2">
              <YStack
                bg="$borderColor"
                overflow="hidden"
                style={layoutStyles.confidenceBarOuter}
              >
                <YStack
                  style={
                    {
                      height: 6,
                      borderRadius: 4,
                      backgroundColor: confidenceColor,
                      width: confidenceWidth,
                    } as ViewStyle
                  }
                />
              </YStack>
              <Text
                fontSize="$2"
                fontWeight="600"
                style={{ color: confidenceColor } as TextStyle}
              >
                {confidenceLabel}
              </Text>
            </XStack>
          </XStack>
        </YStack>

        {/* Collapsible Raw SMS */}
        <Button
          size="$3"
          chromeless
          onPress={toggleRawSms}
          iconAfter={showRawSms ? ChevronUp : ChevronDown}
          aria-label={
            showRawSms
              ? t("smsImport.reviewQueue.hideRawSms")
              : t("smsImport.reviewQueue.showRawSms")
          }
        >
          {t("smsImport.reviewQueue.rawSms")}
        </Button>
        {showRawSms && (
          <YStack bg="$backgroundFocus" p="$3" rounded="$2">
            <Text fontSize="$2" color="$color" opacity={0.8} fontFamily="$body">
              {parsed.metadata.rawMessage}
            </Text>
          </YStack>
        )}

        <Separator />

        {/* Category Selector */}
        <YStack gap="$2">
          <Label color="$color" opacity={0.8}>
            {t("smsImport.reviewQueue.category")}
          </Label>
          <XStack style={layoutStyles.categoryRow}>
            {categories.map((cat) => (
              <CategoryCard
                key={cat.label}
                isSelected={category === cat.label}
                categoryColor={cat.color}
                label={cat.label}
                onPress={() => handleCategorySelect(cat.label)}
                compact
              />
            ))}
          </XStack>
        </YStack>

        {/* Payment Method Selector */}
        <YStack gap="$2">
          <Label color="$color" opacity={0.8}>
            {t("smsImport.reviewQueue.paymentMethod")}
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
        </YStack>

        {/* Note Input */}
        <YStack gap="$2">
          <Label color="$color" opacity={0.8}>
            {t("smsImport.reviewQueue.note")}
          </Label>
          <Input
            size="$4"
            placeholder={t("smsImport.reviewQueue.notePlaceholder")}
            value={note}
            onChangeText={handleNoteChange}
            aria-label={t("smsImport.reviewQueue.note")}
          />
        </YStack>

        {/* Apply to Future Checkbox */}
        <XStack items="center" gap="$3" style={layoutStyles.touchTarget}>
          <Checkbox
            id="apply-to-future"
            checked={applyToFuture}
            onCheckedChange={handleApplyToFutureChange}
            size="$4"
            aria-label={t("smsImport.reviewQueue.applyToFuture")}
          >
            <Checkbox.Indicator>
              <Check size={16} />
            </Checkbox.Indicator>
          </Checkbox>
          <Label htmlFor="apply-to-future" color="$color" fontSize="$3">
            {t("smsImport.reviewQueue.applyToFuture")}
          </Label>
        </XStack>

        <Separator />

        {/* Action Buttons */}
        <YStack gap="$3">
          <XStack style={layoutStyles.actionRow}>
            {isEditing ? (
              <Button
                flex={1}
                size="$4"
                themeInverse
                onPress={handleEdit}
                icon={<Edit3 size={18} />}
                fontWeight="bold"
                style={layoutStyles.touchTarget}
                aria-label={t("smsImport.reviewQueue.edit")}
              >
                {t("smsImport.reviewQueue.edit")}
              </Button>
            ) : (
              <Button
                flex={1}
                size="$4"
                themeInverse
                onPress={handleConfirm}
                icon={<Check size={18} />}
                fontWeight="bold"
                style={layoutStyles.touchTarget}
                aria-label={t("smsImport.reviewQueue.confirm")}
              >
                {t("smsImport.reviewQueue.confirm")}
              </Button>
            )}
            <Button
              flex={1}
              size="$4"
              chromeless
              onPress={handleReject}
              icon={<X size={18} />}
              color="$red10"
              style={layoutStyles.touchTarget}
              aria-label={t("smsImport.reviewQueue.reject")}
            >
              {t("smsImport.reviewQueue.reject")}
            </Button>
          </XStack>

          {/* Bulk Actions */}
          {pendingCount > 1 && (
            <XStack style={layoutStyles.actionRow}>
              <Button
                flex={1}
                size="$3"
                onPress={handleConfirmAll}
                icon={<CheckCheck size={16} />}
                style={layoutStyles.touchTarget}
                aria-label={t("smsImport.reviewQueue.confirmAll")}
              >
                {t("smsImport.reviewQueue.confirmAll")}
              </Button>
              <Button
                flex={1}
                size="$3"
                chromeless
                onPress={handleRejectAll}
                icon={<XCircle size={16} />}
                color="$red10"
                style={layoutStyles.touchTarget}
                aria-label={t("smsImport.reviewQueue.rejectAll")}
              >
                {t("smsImport.reviewQueue.rejectAll")}
              </Button>
            </XStack>
          )}
        </YStack>
      </YStack>
    </AppSheetScaffold>
  )
}

export type { ReviewQueueModalProps }
