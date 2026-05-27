import React, { memo, useCallback, useRef } from "react"
import { XStack, YStack, Text, Button } from "tamagui"


import { Trash, Edit3 } from "@tamagui/lucide-icons-2"

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
import { UI_OPACITY, UI_FONT_WEIGHT } from "../../constants/ui-tokens"

const layoutStyles = {
  expenseDetails: {
    alignItems: "center",
  },
  actionButtons: {
    alignItems: "center",
  },
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

  const expenseRef = useRef(expense)
  expenseRef.current = expense

  const handleEdit = useCallback(() => {
    onEdit?.(expenseRef.current)
  }, [onEdit])

  const handleDelete = useCallback(() => {
    onDelete?.(expenseRef.current.id)
  }, [onDelete])

  const paymentMethodDisplay = showPaymentMethod
    ? formatPaymentMethodDisplay(expense.paymentMethod, instruments)
    : null

  const subtitleDate = subtitleMode === "time" ? "h:mm a" : "dd/MM/yyyy"
  const categoryLabel =
    categoryInfo.label === "Other" ? t("settings.categories.other") : categoryInfo.label

  return (
    <ExpenseCard>
      <XStack flex={1} gap="$section" style={layoutStyles.expenseDetails}>
        <DynamicCategoryIcon
          name={categoryInfo.icon}
          size={subtitleMode === "time" ? 20 : 16}
          color={categoryInfo.color as `#${string}`}
        />
        <YStack flex={1}>
          <Text fontWeight={UI_FONT_WEIGHT.bold} fontSize="$label">
            {expense.note || categoryLabel}
          </Text>
          <Text color="$color" opacity={UI_OPACITY.subtle} fontSize="$caption">
            {formatDate(expense.date, subtitleDate)} • {categoryLabel}
          </Text>
          {paymentMethodDisplay ? (
            <Text color="$color" opacity={UI_OPACITY.faint} fontSize="$caption">
              {paymentMethodDisplay}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      <XStack gap="$section" style={layoutStyles.actionButtons}>
        <AmountText type="expense">
          -{formatCurrency(expense.amount, expense.currency)}
        </AmountText>

        {showActions ? (
          <>
            <Button
              size="$chip"
              icon={Edit3}
              chromeless
              onPress={handleEdit}
              aria-label={t("common.edit")}
            />
            <Button
              size="$chip"
              icon={Trash}
              chromeless
              onPress={handleDelete}
              aria-label={t("common.delete")}
            />
          </>
        ) : null}
      </XStack>
    </ExpenseCard>
  )
})
