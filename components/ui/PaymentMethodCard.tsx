import { Card, XStack, Text } from "tamagui"
import { memo } from "react"
import { PaymentMethodConfig } from "../../constants/payment-methods"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"

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
      bordered
      padding="$2"
      paddingHorizontal="$3"
      backgroundColor={isSelected ? "$color5" : "$background"}
      borderColor={isSelected ? ACCENT_COLORS.primary : "$borderColor"}
      borderWidth={isSelected ? 2 : 1}
      onPress={onPress}
    >
      <XStack gap="$2" style={{ alignItems: "center" }}>
        <Icon size={16} color={isSelected ? ACCENT_COLORS.primary : "$color"} />
        <Text fontSize="$2" fontWeight={isSelected ? "bold" : "normal"}>
          {t(`paymentMethods.${config.i18nKey}`)}
        </Text>
      </XStack>
    </Card>
  )
})
