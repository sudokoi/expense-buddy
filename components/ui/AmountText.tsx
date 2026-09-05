import { Text, type TextProps, type TextStyle } from "react-native"
import { UI_FONT_WEIGHT, UI_FONT_SIZE } from "../../constants/ui-tokens"
import { SEMANTIC_FOREGROUND_COLORS } from "../../constants/palette"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"

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
  const status = SEMANTIC_FOREGROUND_COLORS[useThemeScheme()]
  const color =
    type === "expense"
      ? status.error
      : type === "income"
        ? status.success
        : theme.foreground

  return (
    <Text
      style={[
        { fontWeight: UI_FONT_WEIGHT.bold, fontSize: UI_FONT_SIZE.title, color },
        style,
      ]}
      {...props}
    />
  )
}

export type { AmountTextProps }
