import { Text, Card, View, XStack, useTheme } from "tamagui"
import { Pressable, ViewStyle } from "react-native"
import { Ban } from "@tamagui/lucide-icons"
import { PaymentMethodType } from "../../types/expense"
import {
  PAYMENT_METHODS,
  PaymentMethodConfig,
  getPaymentMethodI18nKey,
} from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { getColorValue } from "../../tamagui.config"

interface DefaultPaymentMethodSelectorProps {
  value?: PaymentMethodType
  onChange: (type: PaymentMethodType | undefined) => void
}

const styles = {
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  } as ViewStyle,
  option: {
    minHeight: 44, // Accessibility: minimum touch target
  } as ViewStyle,
  optionInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
  } as ViewStyle,
}

const ICON_SIZE = 16

/**
 * DefaultPaymentMethodSelector - A selector for choosing default payment method in settings
 *
 * Displays all payment method types plus a "None" option
 * Uses PaymentMethodCard-style display for each option
 *
 * @param value - Current default payment method (undefined means "None")
 * @param onChange - Callback when selection changes
 */
export function DefaultPaymentMethodSelector({
  value,
  onChange,
}: DefaultPaymentMethodSelectorProps) {
  const { t } = useTranslation()
  const theme = useTheme()

  const renderOption = (
    key: PaymentMethodType | "none",
    label: string,
    Icon: PaymentMethodConfig["icon"] | typeof Ban,
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
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${displayLabel} payment method`}
        style={({ pressed }) => [styles.option, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View
          borderWidth={2}
          bg={isSelected ? "$backgroundFocus" : "transparent"}
          borderColor={isSelected ? getColorValue(theme.borderColorFocus) : "transparent"}
          style={styles.optionInner}
        >
          <Icon
            size={ICON_SIZE}
            color={getColorValue(theme.color)}
            opacity={isSelected ? 1 : 0.7}
          />
          <Text
            fontSize="$2"
            fontWeight={isSelected ? "600" : "400"}
            color="$color"
            opacity={isSelected ? 1 : 0.7}
          >
            {displayLabel}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Card bordered padding="$2" borderRadius="$4" gap="$2">
      <XStack flexWrap="wrap" gap="$2">
        {/* None option */}
        {renderOption("none", "None", Ban, value === undefined)}

        {/* Payment method options */}
        {PAYMENT_METHODS.map((method) =>
          renderOption(method.value, method.label, method.icon, value === method.value)
        )}
      </XStack>
    </Card>
  )
}

export type { DefaultPaymentMethodSelectorProps }
