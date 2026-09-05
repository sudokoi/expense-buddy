import { Pressable, View, Text } from "react-native"
import { memo } from "react"
import { PaymentMethodConfig } from "../../constants/payment-methods"
import { useTranslation } from "react-i18next"
import { UI_FONT_WEIGHT, UI_BORDER_WIDTH, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { Check } from "lucide-react-native"

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
      className="min-h-12 max-w-full justify-center rounded-control p-2 px-3 active:opacity-60"
      style={{
        backgroundColor: isSelected ? theme.accent : theme.surface,
        borderColor: isSelected ? accent : theme.border,
        borderWidth: UI_BORDER_WIDTH.thin,
      }}
    >
      <View className="flex-row items-center gap-2">
        {isSelected ? (
          <Check size={UI_ICON_SIZE.small} color={theme.accentForeground} />
        ) : (
          <Icon size={UI_ICON_SIZE.small} color={theme.foreground} />
        )}
        <Text
          className="shrink text-sm text-foreground"
          style={{
            fontWeight: isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal,
            color: isSelected ? theme.accentForeground : theme.foreground,
          }}
        >
          {t(`paymentMethods.${config.i18nKey}`)}
        </Text>
      </View>
    </Pressable>
  )
})
