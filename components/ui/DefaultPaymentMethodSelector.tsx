import { Text, Card, View, XStack, useTheme } from "tamagui"
import { Pressable } from "react-native"
import { Ban } from "@tamagui/lucide-icons-2"
import { PaymentMethodType } from "../../types/expense"
import {
  PAYMENT_METHODS,
  PaymentMethodConfig,
  getPaymentMethodI18nKey,
} from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { getColorValue } from "../../tamagui.config"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"

interface DefaultPaymentMethodSelectorProps {
  value?: PaymentMethodType
  onChange: (type: PaymentMethodType | undefined) => void
}

const styles = {
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  option: {
    minHeight: 44, // Accessibility: minimum touch target
  },
  optionInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: UI_SPACE.control,
    padding: UI_SPACE.control,
    borderRadius: UI_RADIUS.control,
  },
} as const

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
        role="button"
        aria-selected={isSelected}
        aria-label={`${displayLabel} payment method`}
        style={({ pressed }) => [styles.option, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View
          borderWidth={UI_BORDER_WIDTH.normal}
          bg={isSelected ? "$backgroundFocus" : "transparent"}
          borderColor={isSelected ? getColorValue(theme.borderColorFocus) : "transparent"}
          style={styles.optionInner}
        >
          <Icon
            size={UI_ICON_SIZE.small}
            color={getColorValue(theme.color)}
            opacity={isSelected ? 1 : UI_OPACITY.medium}
          />
          <Text
            fontSize="$caption"
            fontWeight={isSelected ? UI_FONT_WEIGHT.semiBold : UI_FONT_WEIGHT.normal}
            color="$color"
            opacity={isSelected ? 1 : UI_OPACITY.medium}
          >
            {displayLabel}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Card
      borderWidth={UI_BORDER_WIDTH.thin}
      borderColor="$borderColor"
      p="$control"
      rounded="$control"
      gap="$control"
    >
      <XStack flexWrap="wrap" gap="$control">
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
