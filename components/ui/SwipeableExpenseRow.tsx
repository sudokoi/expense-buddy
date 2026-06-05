import React, { memo, useCallback } from "react"
import { Animated } from "react-native"
import { XStack } from "tamagui"
import { Edit3, Trash } from "@tamagui/lucide-icons-2"
import { useTranslation } from "react-i18next"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { ExpenseRow, type ExpenseRowSubtitleMode } from "./ExpenseRow"
import { IconActionButton } from "./IconActionButton"
import { useSwipeReveal } from "../../hooks/use-swipe-reveal"
import { UI_SPACE } from "../../constants/ui-tokens"

const SWIPE_THRESHOLD = 80
const OPEN_RATIO = 0.85

interface SwipeableExpenseRowProps {
  expense: Expense
  categoryInfo: Pick<Category, "label" | "icon" | "color">
  instruments: PaymentInstrument[]
  subtitleMode: ExpenseRowSubtitleMode
  showPaymentMethod?: boolean
  isReadOnly?: boolean
  onEdit?: (expense: Expense) => void
  onDelete?: (id: string) => void
}

export const SwipeableExpenseRow = memo(function SwipeableExpenseRow({
  expense,
  categoryInfo,
  instruments,
  subtitleMode,
  showPaymentMethod = true,
  isReadOnly = false,
  onEdit,
  onDelete,
}: SwipeableExpenseRowProps) {
  const { t } = useTranslation()

  const { translateX, panResponder, snapTo, actionsWidthRef } = useSwipeReveal({
    swipeThreshold: SWIPE_THRESHOLD,
    openRatio: OPEN_RATIO,
    direction: "left",
  })

  const handleEdit = useCallback(() => {
    snapTo(0)
    onEdit?.(expense)
  }, [onEdit, expense, snapTo])

  const handleDelete = useCallback(() => {
    snapTo(0)
    onDelete?.(expense.id)
  }, [onDelete, expense.id, snapTo])

  if (isReadOnly) {
    return (
      <ExpenseRow
        expense={expense}
        categoryInfo={categoryInfo}
        instruments={instruments}
        subtitleMode={subtitleMode}
        showPaymentMethod={showPaymentMethod}
        showActions={false}
      />
    )
  }

  return (
    <XStack overflow="hidden">
      <XStack
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
        }}
        gap="$control"
        pl={UI_SPACE.control}
        pr={UI_SPACE.control}
        onLayout={(e) => {
          actionsWidthRef.current = e.nativeEvent.layout.width
        }}
      >
        <IconActionButton
          size="$compact"
          icon={Edit3}
          chromeless
          circular
          onPress={handleEdit}
          tooltip={t("common.edit")}
        />
        <IconActionButton
          size="$compact"
          icon={Trash}
          chromeless
          circular
          onPress={handleDelete}
          tooltip={t("common.delete")}
        />
      </XStack>
      <Animated.View
        style={[{ transform: [{ translateX }], flex: 1 }]}
        {...panResponder.panHandlers}
      >
        <ExpenseRow
          expense={expense}
          categoryInfo={categoryInfo}
          instruments={instruments}
          subtitleMode={subtitleMode}
          showPaymentMethod={showPaymentMethod}
          showActions={false}
        />
      </Animated.View>
    </XStack>
  )
})
