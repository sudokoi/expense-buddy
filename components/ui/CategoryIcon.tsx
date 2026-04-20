import { YStack } from "tamagui"
import { ViewStyle, StyleProp } from "react-native"
import { ReactNode } from "react"
import { UI_RADIUS } from "../../constants/ui-tokens"

type IconSize = "sm" | "md" | "lg"

interface CategoryIconProps {
  size?: IconSize
  backgroundColor?: string
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

const sizeStyles: Record<IconSize, ViewStyle> = {
  sm: {
    width: 32,
    height: 32,
    borderRadius: UI_RADIUS.control,
    alignItems: "center",
    justifyContent: "center",
  },
  md: {
    width: 40,
    height: 40,
    borderRadius: UI_RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: {
    width: 48,
    height: 48,
    borderRadius: UI_RADIUS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
}

/**
 * CategoryIcon - A styled container for category icons
 * Supports sm, md, and lg size variants
 */
export function CategoryIcon({
  size = "md",
  backgroundColor,
  children,
  style,
}: CategoryIconProps) {
  const sizeStyle = sizeStyles[size]
  return (
    <YStack style={[sizeStyle, { backgroundColor }, style] as ViewStyle[]}>
      {children}
    </YStack>
  )
}

export type { CategoryIconProps }
