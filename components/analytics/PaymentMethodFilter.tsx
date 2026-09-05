import React, { memo, useCallback, useMemo } from "react"
import { PAYMENT_METHODS } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import type { PaymentMethodType } from "../../types/expense"
import { FilterChip, FilterChipBar } from "./FilterChipBar"

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
    <FilterChipBar>
      <FilterChip
        label={t("common.all")}
        selected={isAllSelected}
        onPress={handleAllPress}
      />

      {chipItems.map((item) => {
        const isSelected = selected.includes(item.key)
        const label =
          item.key === NONE_KEY ? t("common.none") : t(`paymentMethods.${item.i18nKey}`)

        return (
          <FilterChip
            key={item.key}
            label={label}
            selected={isSelected}
            onPress={() => handleToggle(item.key)}
            Icon={item.Icon}
          />
        )
      })}
    </FilterChipBar>
  )
})

export type { PaymentMethodFilterProps }
