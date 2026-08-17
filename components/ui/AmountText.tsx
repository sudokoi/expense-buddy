import { Text, type TextProps, type TextStyle } from "react-native"
import { UI_FONT_WEIGHT } from "../../constants/ui-tokens"
import { AMOUNT_COLORS } from "../../constants/palette"
import { useThemeColors } from "../../hooks/use-theme-colors"

type AmountType = "expense" | "income" | "neutral"

interface AmountTextProps extends Omit<TextProps, "style"> {
  type?: AmountType
  style?: TextStyle | TextStyle[]
}

/**
 * AmountText - A styled Text component for displaying currency amounts
 * Supports expense (red), income (green), and neutral variants
 */
export function AmountText({ type = "expense", style, ...props }: AmountTextProps) {
  const theme = useThemeColors()
  const color =
    type === "expense"
      ? AMOUNT_COLORS.expense
      : type === "income"
        ? AMOUNT_COLORS.income
        : theme.foreground

  return (
    <Text
      style={[{ fontWeight: UI_FONT_WEIGHT.bold, fontSize: 16, color }, style]}
      {...props}
    />
  )
}

export type { AmountTextProps }
