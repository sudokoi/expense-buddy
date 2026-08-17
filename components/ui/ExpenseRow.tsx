import React, { memo, useCallback, useRef } from "react"
import { View, Text } from "react-native"

import { Trash, Edit3 } from "lucide-react-native"

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
import { UI_OPACITY, UI_FONT_WEIGHT, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { IconActionButton } from "./IconActionButton"
import { useThemeColors } from "../../hooks/use-theme-colors"

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
  const theme = useThemeColors()

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
      <View className="flex-1 flex-row items-center gap-3">
        <DynamicCategoryIcon
          name={categoryInfo.icon}
          size={subtitleMode === "time" ? 20 : 16}
          color={categoryInfo.color as `#${string}`}
        />
        <View className="flex-1">
          <Text
            className="text-sm text-foreground"
            style={{ fontWeight: UI_FONT_WEIGHT.bold }}
          >
            {expense.note || categoryLabel}
          </Text>
          <Text
            className="text-xs text-foreground"
            style={{ opacity: UI_OPACITY.subtle }}
          >
            {formatDate(expense.date, subtitleDate)} • {categoryLabel}
          </Text>
          {paymentMethodDisplay ? (
            <Text
              className="text-xs text-foreground"
              style={{ opacity: UI_OPACITY.faint }}
            >
              {paymentMethodDisplay}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <AmountText type="expense">
          -{formatCurrency(expense.amount, expense.currency)}
        </AmountText>

        {showActions ? (
          <>
            <IconActionButton
              icon={<Edit3 size={UI_ICON_SIZE.small} color={theme.foreground} />}
              onPress={handleEdit}
              tooltip={t("common.edit")}
              accessibilityLabel={t("common.edit")}
            />
            <IconActionButton
              icon={<Trash size={UI_ICON_SIZE.small} color={theme.foreground} />}
              onPress={handleDelete}
              tooltip={t("common.delete")}
              accessibilityLabel={t("common.delete")}
            />
          </>
        ) : null}
      </View>
    </ExpenseCard>
  )
})
