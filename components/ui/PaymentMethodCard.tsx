import { Card, XStack, Text } from "tamagui"
import { memo } from "react"
import { PaymentMethodConfig } from "../../constants/payment-methods"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"
import { UI_FONT_WEIGHT, UI_BORDER_WIDTH, UI_ICON_SIZE } from "../../constants/ui-tokens"

interface PaymentMethodCardProps {
  config: PaymentMethodConfig
  isSelected: boolean
  onPress: () => void
}

/**
 * Reusable payment method selection card component.
 * Used in both Add Expense and History screens for consistent payment method selection UI.
 * Memoized to prevent unnecessary re-renders when other payment methods change.
 */
export const PaymentMethodCard = memo(function PaymentMethodCard({
  config,
  isSelected,
  onPress,
}: PaymentMethodCardProps) {
  const { t } = useTranslation()
  const Icon = config.icon
  return (
    <Card
      p="$control"
      px="$section"
      bg={isSelected ? "$color5" : "$background"}
      borderColor={isSelected ? ACCENT_COLORS.primary : "$borderColor"}
      borderWidth={isSelected ? UI_BORDER_WIDTH.normal : UI_BORDER_WIDTH.thin}
      onPress={onPress}
    >
      <XStack gap="$control" items="center">
        <Icon size={UI_ICON_SIZE.small} color={isSelected ? ACCENT_COLORS.primary : "$color"} />
        <Text fontSize="$caption" fontWeight={isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal}>
          {t(`paymentMethods.${config.i18nKey}`)}
        </Text>
      </XStack>
    </Card>
  )
})
