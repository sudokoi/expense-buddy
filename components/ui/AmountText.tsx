import { Text, TextProps, ColorTokens } from "tamagui"
import { UI_FONT_WEIGHT } from "../../constants/ui-tokens"

type AmountType = "expense" | "income" | "neutral"

interface AmountTextProps extends Omit<TextProps, "color"> {
  type?: AmountType
}

/**
 * AmountText - A styled Text component for displaying currency amounts
 * Supports expense (red), income (green), and neutral variants
 */
export function AmountText({ type = "expense", ...props }: AmountTextProps) {
  const colorMap: Record<AmountType, ColorTokens> = {
    expense: "$red10",
    income: "$green10",
    neutral: "$color",
  }

  return <Text fontWeight={UI_FONT_WEIGHT.bold} fontSize="$title" color={colorMap[type]} {...props} />
}

export type { AmountTextProps }
