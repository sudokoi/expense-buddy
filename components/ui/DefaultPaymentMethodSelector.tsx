import { View, Text } from "react-native"
import { Pressable } from "react-native"
import { Ban, type LucideIcon } from "lucide-react-native"
import { PaymentMethodType } from "../../types/expense"
import { PAYMENT_METHODS, getPaymentMethodI18nKey } from "../../constants/payment-methods"
import { Card } from "./Card"
import { useTranslation } from "react-i18next"
import {
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface DefaultPaymentMethodSelectorProps {
  value?: PaymentMethodType
  onChange: (type: PaymentMethodType | undefined) => void
}

const styles = {
  option: {
    minHeight: 44, // Accessibility: minimum touch target
  },
} as const

/**
 * DefaultPaymentMethodSelector - A selector for choosing default payment method in settings
 */
export function DefaultPaymentMethodSelector({
  value,
  onChange,
}: DefaultPaymentMethodSelectorProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()

  const renderOption = (
    key: PaymentMethodType | "none",
    label: string,
    Icon: LucideIcon,
    isSelected: boolean
  ) => {
    const displayLabel =
      key === "none"
        ? t("settings.defaultPayment.none")
        : t(`paymentMethods.${getPaymentMethodI18nKey(key as PaymentMethodType)}`)

    return (
      <Pressable
        key={key}
        onPress={() => onChange(key === "none" ? undefined : (key as PaymentMethodType))}
        role="button"
        aria-selected={isSelected}
        aria-label={`${displayLabel} payment method`}
        style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View
          className="flex-row items-center justify-center gap-2 rounded-control p-2"
          style={{
            borderWidth: UI_BORDER_WIDTH.normal,
            backgroundColor: isSelected ? theme.muted : "transparent",
            borderColor: isSelected ? theme.accent : "transparent",
          }}
        >
          <Icon
            size={UI_ICON_SIZE.small}
            color={theme.foreground}
            style={{ opacity: isSelected ? 1 : UI_OPACITY.medium }}
          />
          <Text
            className="text-xs text-foreground"
            style={{
              fontWeight: isSelected ? UI_FONT_WEIGHT.semiBold : UI_FONT_WEIGHT.normal,
              opacity: isSelected ? 1 : UI_OPACITY.medium,
            }}
          >
            {displayLabel}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Card className="gap-2 rounded-control p-2">
      <View className="flex-row flex-wrap gap-2">
        {renderOption("none", "None", Ban, value === undefined)}

        {PAYMENT_METHODS.map((method) =>
          renderOption(
            method.value,
            method.label,
            method.icon as LucideIcon,
            value === method.value
          )
        )}
      </View>
    </Card>
  )
}

export type { DefaultPaymentMethodSelectorProps }
