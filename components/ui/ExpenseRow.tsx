import { memo, useCallback, useRef } from "react"
import { Pressable, View, Text } from "react-native"

import { Pencil, Trash2 } from "lucide-react-native"

import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { formatPaymentMethodDisplay } from "../../utils/payment-method-display"
import { ExpenseCard } from "./ExpenseCard"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { formatDate } from "../../utils/date"
import { formatCurrency } from "../../utils/currency"
import { useTranslation } from "react-i18next"
import { UI_FONT_WEIGHT, UI_ICON_SIZE } from "../../constants/ui-tokens"
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

  const subtitleDate = subtitleMode === "time" ? "p" : "PP"
  const categoryLabel =
    categoryInfo.label === "Other" ? t("settings.categories.other") : categoryInfo.label

  return (
    <ExpenseCard>
      <Pressable
        className="flex-1 flex-row items-center gap-3 py-1"
        onPress={showActions ? handleEdit : undefined}
        accessibilityRole={showActions ? "button" : undefined}
        accessibilityHint={showActions ? t("common.edit") : undefined}
        style={({ pressed }) => ({ opacity: pressed && showActions ? 0.6 : 1 })}
      >
        <DynamicCategoryIcon
          name={categoryInfo.icon}
          size={subtitleMode === "time" ? 20 : 16}
          color={categoryInfo.color as `#${string}`}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <Text
              className="min-w-[100px] flex-1 text-sm text-foreground"
              style={{ fontWeight: UI_FONT_WEIGHT.bold }}
              numberOfLines={2}
            >
              {expense.note || categoryLabel}
            </Text>
            <Text
              className="text-right text-base font-semibold text-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatCurrency(Math.abs(expense.amount), expense.currency)}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {formatDate(expense.date, subtitleDate)} • {categoryLabel}
          </Text>
          {paymentMethodDisplay ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {paymentMethodDisplay}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {showActions ? (
        <View className="flex-row">
          <IconActionButton
            icon={<Pencil size={UI_ICON_SIZE.medium} color={theme.foreground} />}
            onPress={handleEdit}
            tooltip={t("common.edit")}
            accessibilityLabel={t("common.editLabel", {
              label: expense.note || categoryLabel,
            })}
          />
          <IconActionButton
            icon={<Trash2 size={UI_ICON_SIZE.medium} color={theme.foreground} />}
            onPress={handleDelete}
            tooltip={t("common.delete")}
            accessibilityLabel={t("common.deleteLabel", {
              label: expense.note || categoryLabel,
            })}
          />
        </View>
      ) : null}
    </ExpenseCard>
  )
})
