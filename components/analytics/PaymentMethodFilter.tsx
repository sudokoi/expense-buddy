import React, { memo, useCallback, useMemo } from "react"
import { ScrollView, Text, View, ViewStyle } from "react-native"
import { Button } from "../ui/Button"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { PAYMENT_METHOD_COLORS } from "../../constants/payment-method-colors"
import type { PaymentMethodType } from "../../types/expense"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_SPACE } from "../../constants/ui-tokens"

export type PaymentMethodSelectionKey = PaymentMethodType | "__none__"

interface PaymentMethodFilterProps {
  selected: PaymentMethodSelectionKey[]
  onChange: (selected: PaymentMethodSelectionKey[]) => void
}

const styles = {
  scrollView: {
    marginBottom: UI_SPACE.gutter,
  },
  contentContainer: {
    paddingHorizontal: UI_SPACE.micro,
  },
} as const

const NONE_KEY: PaymentMethodSelectionKey = "__none__"

function getColorForKey(key: PaymentMethodSelectionKey): string {
  if (key === NONE_KEY) return PAYMENT_METHOD_COLORS.Other
  return PAYMENT_METHOD_COLORS[key] ?? PAYMENT_METHOD_COLORS.Other
}

/**
 * PaymentMethodFilter - Multi-select chips for filtering analytics by payment method.
 * Empty selection means "All".
 */
export const PaymentMethodFilter = memo(function PaymentMethodFilter({
  selected,
  onChange,
}: PaymentMethodFilterProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const isAllSelected = selected.length === 0

  const chipItems = useMemo(() => {
    const items: Array<{
      key: PaymentMethodSelectionKey
      label: string
      i18nKey?: string
      Icon?: React.ComponentType<{ size?: number; color?: string }>
      selectedStyle: ViewStyle
    }> = []

    items.push({
      key: NONE_KEY,
      label: "None",
      selectedStyle: { backgroundColor: getColorForKey(NONE_KEY) },
    })

    for (const method of PAYMENT_METHODS) {
      const color = getColorForKey(method.value)
      items.push({
        key: method.value,
        label: method.label,
        i18nKey: method.i18nKey,
        Icon: method.icon as unknown as React.ComponentType<{
          size?: number
          color?: string
        }>,
        selectedStyle: { backgroundColor: color },
      })
    }

    return items
  }, [])

  const handleAllPress = useCallback(() => {
    onChange([])
  }, [onChange])

  const handleToggle = useCallback(
    (key: PaymentMethodSelectionKey) => {
      if (selected.includes(key)) {
        onChange(selected.filter((k) => k !== key))
      } else {
        onChange([...selected, key])
      }
    },
    [selected, onChange]
  )

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <View className="flex-row gap-2">
        <Button
          size="chip"
          className="px-2"
          variant={isAllSelected ? "accent" : "outline"}
          onPress={handleAllPress}
        >
          <Text>{t("common.all")}</Text>
        </Button>

        {chipItems.map((item) => {
          const isSelected = selected.includes(item.key)
          const Icon = item.Icon
          const label =
            item.key === NONE_KEY ? t("common.none") : t(`paymentMethods.${item.i18nKey}`)

          return (
            <Button
              key={item.key}
              size="chip"
              className={`gap-1 px-2${isSelected ? "" : " border border-border"}`}
              style={isSelected ? item.selectedStyle : undefined}
              onPress={() => handleToggle(item.key)}
            >
              {Icon ? (
                <Icon size={14} color={isSelected ? "white" : theme.foreground} />
              ) : null}
              <Text className={isSelected ? "text-white" : "text-foreground"}>{label}</Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { PaymentMethodFilterProps }
