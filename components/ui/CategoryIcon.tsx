import { YStack } from "tamagui"
import { ViewStyle, StyleProp } from "react-native"
import { ReactNode } from "react"

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
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  md: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
