import { YStack } from "tamagui"
import { ViewStyle, StyleProp } from "react-native"
import { ReactNode } from "react"
import { UI_RADIUS, UI_ICON_SIZE } from "../../constants/ui-tokens"

type IconSize = "sm" | "md" | "lg"

interface CategoryIconProps {
  size?: IconSize
  backgroundColor?: string
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

const sizeStyles: Record<IconSize, ViewStyle> = {
  sm: {
    width: UI_ICON_SIZE.xlarge,
    height: UI_ICON_SIZE.xlarge,
    borderRadius: UI_RADIUS.control,
    alignItems: "center",
    justifyContent: "center",
  },
  md: {
    width: UI_ICON_SIZE.xxlarge,
    height: UI_ICON_SIZE.xxlarge,
    borderRadius: UI_RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: {
    width: UI_ICON_SIZE.xxxlarge,
    height: UI_ICON_SIZE.xxxlarge,
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
