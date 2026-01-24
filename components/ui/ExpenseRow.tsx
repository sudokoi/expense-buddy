import React, { memo } from "react"
import { XStack, YStack, Text, Button } from "tamagui"

import type { ViewStyle } from "react-native"
import { Trash, Edit3 } from "@tamagui/lucide-icons"

import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { formatPaymentMethodDisplay } from "../../utils/payment-method-display"
import { ExpenseCard } from "./ExpenseCard"
import { AmountText } from "./AmountText"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { formatDate } from "../../utils/date"
import { formatCurrency } from "../../utils/currency"
import { useTranslation } from "react-i18next"

const layoutStyles = {
  expenseDetails: {
    alignItems: "center",
  } as ViewStyle,
  actionButtons: {
    alignItems: "center",
  } as ViewStyle,
}

export type ExpenseRowSubtitleMode = "time" | "date"

export interface ExpenseRowProps {
  expense: Expense
  categoryInfo: Pick<Category, "label" | "icon" | "color">
  instruments: PaymentInstrument[]
  subtitleMode: ExpenseRowSubtitleMode
  showPaymentMethod?: boolean
  showActions?: boolean
  onEdit?: (expense: Expense) => void
  onDelete?: (id: string) => void
}

export const ExpenseRow = memo(function ExpenseRow({
  expense,
  categoryInfo,
  instruments,
  subtitleMode,
  showPaymentMethod = true,
  showActions = false,
  onEdit,
  onDelete,
}: ExpenseRowProps) {
  const { t } = useTranslation()
  const paymentMethodDisplay = showPaymentMethod
    ? formatPaymentMethodDisplay(expense.paymentMethod, instruments)
    : null

  const subtitleDate = subtitleMode === "time" ? "h:mm a" : "dd/MM/yyyy"

  return (
    <ExpenseCard>
      <XStack flex={1} gap="$3" style={layoutStyles.expenseDetails}>
        <DynamicCategoryIcon
          name={categoryInfo.icon}
          size={subtitleMode === "time" ? 20 : 16}
          color={categoryInfo.color as `#${string}`}
        />
        <YStack flex={1}>
          <Text fontWeight="bold" fontSize="$4">
            {expense.note || categoryInfo.label}
          </Text>
          <Text color="$color" opacity={0.6} fontSize="$2">
            {formatDate(expense.date, subtitleDate)} • {categoryInfo.label}
          </Text>
          {paymentMethodDisplay ? (
            <Text color="$color" opacity={0.5} fontSize="$2">
              {paymentMethodDisplay}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      <XStack gap="$3" style={layoutStyles.actionButtons}>
        <AmountText type="expense">
          -{formatCurrency(expense.amount, expense.currency)}
        </AmountText>

        {showActions ? (
          <>
            <Button
              size="$2"
              icon={Edit3}
              chromeless
              onPress={() => onEdit?.(expense)}
              aria-label={t("common.edit")}
            />
            <Button
              size="$2"
              icon={Trash}
              chromeless
              onPress={() => onDelete?.(expense.id)}
              aria-label={t("common.delete")}
            />
          </>
        ) : null}
      </XStack>
    </ExpenseCard>
  )
})
