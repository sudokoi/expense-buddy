import React, { memo, useCallback, useMemo } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView, ViewStyle } from "react-native"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { PAYMENT_METHOD_COLORS } from "../../constants/payment-method-colors"
import type { PaymentMethodType } from "../../types/expense"

export type PaymentMethodSelectionKey = PaymentMethodType | "__none__"

interface PaymentMethodFilterProps {
  selected: PaymentMethodSelectionKey[]
  onChange: (selected: PaymentMethodSelectionKey[]) => void
}

const styles = {
  scrollView: {
    marginBottom: 16,
  } as ViewStyle,
  contentContainer: {
    paddingHorizontal: 4,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,
}

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
  const isAllSelected = selected.length === 0

  const chipItems = useMemo(() => {
    const items: Array<{
      key: PaymentMethodSelectionKey
      label: string
      i18nKey?: string
      Icon?: React.ComponentType<{ size?: number; color?: string }>
    }> = []

    items.push({ key: NONE_KEY, label: "None" }) // Label handled in render or getLabelForKey if used elsewhere, but here logic differs

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
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <XStack gap="$2">
        <Button
          size="$2"
          themeInverse={isAllSelected}
          bordered={!isAllSelected}
          onPress={handleAllPress}
        >
          {t("common.all")}
        </Button>

        {chipItems.map((item) => {
          const isSelected = selected.includes(item.key)
          const color = getColorForKey(item.key)
          const Icon = item.Icon
          const label =
            item.key === NONE_KEY ? t("common.none") : t(`paymentMethods.${item.i18nKey}`)

          return (
            <Button
              key={item.key}
              size="$2"
              bordered={!isSelected}
              style={isSelected ? { backgroundColor: color } : undefined}
              onPress={() => handleToggle(item.key)}
              icon={
                Icon ? (
                  <Icon size={14} color={isSelected ? "white" : "$color"} />
                ) : undefined
              }
            >
              <Button.Text color={isSelected ? "white" : "$color"}>{label}</Button.Text>
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { PaymentMethodFilterProps }
