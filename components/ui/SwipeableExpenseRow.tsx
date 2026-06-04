import React, { memo, useCallback, useRef } from "react"
import { Animated, PanResponder } from "react-native"
import { XStack } from "tamagui"
import { Edit3, Trash } from "@tamagui/lucide-icons-2"
import { useTranslation } from "react-i18next"
import type { Expense } from "../../types/expense"
import type { Category } from "../../types/category"
import type { PaymentInstrument } from "../../types/payment-instrument"
import { ExpenseRow, type ExpenseRowSubtitleMode } from "./ExpenseRow"
import { IconActionButton } from "./IconActionButton"
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

  const translateX = useRef(new Animated.Value(0)).current
  const isOpenRef = useRef(false)
  const actionsWidthRef = useRef(0)

  const snapTo = useCallback(
    (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start()
      isOpenRef.current = toValue !== 0
    },
    [translateX]
  )

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        const maxOpen = actionsWidthRef.current
        const clamped = Math.min(0, Math.max(-maxOpen, gs.dx))
        translateX.setValue(clamped)
      },
      onPanResponderRelease: (_, gs) => {
        const maxOpen = actionsWidthRef.current
        if (gs.dx < -SWIPE_THRESHOLD && !isOpenRef.current) {
          snapTo(-maxOpen)
        } else {
          snapTo(0)
        }
      },
      onPanResponderTerminate: () => {
        snapTo(0)
      },
    })
  ).current

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
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, alignItems: "center" }}
        gap="$control"
        pl={UI_SPACE.control}
        pr={UI_SPACE.control}
        onLayout={(e) => {
          actionsWidthRef.current = e.nativeEvent.layout.width * OPEN_RATIO
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
