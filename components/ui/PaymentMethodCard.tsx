import { Card, XStack, Text } from "tamagui"
import { PaymentMethodConfig } from "../../constants/payment-methods"
import { ACCENT_COLORS } from "../../constants/theme-colors"

interface PaymentMethodCardProps {
  config: PaymentMethodConfig
  isSelected: boolean
  onPress: () => void
}

/**
 * Reusable payment method selection card component.
 * Used in both Add Expense and History screens for consistent payment method selection UI.
 */
export function PaymentMethodCard({
  config,
  isSelected,
  onPress,
}: PaymentMethodCardProps) {
  const Icon = config.icon
  return (
    <Card
      bordered
      padding="$2"
      paddingHorizontal="$3"
      backgroundColor={isSelected ? "$color5" : "$background"}
      borderColor={isSelected ? ACCENT_COLORS.primary : "$borderColor"}
      borderWidth={isSelected ? 2 : 1}
      pressStyle={{ scale: 0.97, opacity: 0.9 }}
      onPress={onPress}
      animation="quick"
    >
      <XStack gap="$2" alignItems="center">
        <Icon size={16} color={isSelected ? ACCENT_COLORS.primary : "$color"} />
        <Text fontSize="$2" fontWeight={isSelected ? "bold" : "normal"}>
          {config.label}
        </Text>
      </XStack>
    </Card>
  )
}
