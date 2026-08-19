import React, { memo, useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import type { PaymentMethodType } from "../../types/expense"
import { useThemeColors } from "../../hooks/use-theme-colors"

export type PaymentMethodSelectionKey = PaymentMethodType | "__none__"

interface PaymentMethodFilterProps {
  selected: PaymentMethodSelectionKey[]
  onChange: (selected: PaymentMethodSelectionKey[]) => void
}

const NONE_KEY: PaymentMethodSelectionKey = "__none__"

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
    }> = []

    items.push({
      key: NONE_KEY,
      label: "None",
    })

    for (const method of PAYMENT_METHODS) {
      items.push({
        key: method.value,
        label: method.label,
        i18nKey: method.i18nKey,
        Icon: method.icon as unknown as React.ComponentType<{
          size?: number
          color?: string
        }>,
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
      className="mb-5"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      <View className="flex-row gap-2">
        <Button
          size="chip"
          variant={isAllSelected ? "accent" : "outline"}
          onPress={handleAllPress}
          accessibilityState={{ selected: isAllSelected }}
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
              className="gap-1"
              variant="outline"
              style={isSelected ? { backgroundColor: theme.accent } : undefined}
              onPress={() => handleToggle(item.key)}
              accessibilityState={{ selected: isSelected }}
            >
              {Icon ? (
                <Icon
                  size={14}
                  color={isSelected ? theme.accentForeground : theme.foreground}
                />
              ) : null}
              <Text
                className="text-foreground"
                adjustsFontSizeToFit
                numberOfLines={1}
                style={isSelected ? { color: theme.accentForeground } : undefined}
              >
                {label}
              </Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { PaymentMethodFilterProps }
