import { Pressable, View, Text } from "react-native"
import { memo } from "react"
import { PaymentMethodConfig } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { UI_FONT_WEIGHT, UI_BORDER_WIDTH, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface PaymentMethodCardProps {
  config: PaymentMethodConfig
  isSelected: boolean
  onPress: () => void
  accessibilityLabel?: string
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
  accessibilityLabel,
}: PaymentMethodCardProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const Icon = config.icon
  const accent = theme.accent

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t(`paymentMethods.${config.i18nKey}`)}
      accessibilityState={{ selected: isSelected }}
      className="rounded-card bg-surface p-2 px-3"
      style={{
        backgroundColor: isSelected ? theme.muted : theme.muted,
        borderColor: isSelected ? accent : theme.border,
        borderWidth: isSelected ? UI_BORDER_WIDTH.normal : UI_BORDER_WIDTH.thin,
      }}
    >
      <View className="flex-row items-center gap-2">
        <Icon size={UI_ICON_SIZE.small} color={isSelected ? accent : theme.foreground} />
        <Text
          className="text-xs text-foreground"
          style={{
            fontWeight: isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal,
          }}
        >
          {t(`paymentMethods.${config.i18nKey}`)}
        </Text>
      </View>
    </Pressable>
  )
})
