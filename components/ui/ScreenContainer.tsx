import { ScrollView } from "tamagui"
import { ReactNode } from "react"
import { StyleProp, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface ScreenContainerProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * ScreenContainer - A styled ScrollView for consistent screen layouts
 * Provides consistent background color and padding with safe area support
 */
export function ScreenContainer({ children, style }: ScreenContainerProps) {
  const insets = useSafeAreaInsets()
  // Using type assertion to work around Tamagui's complex type inference
  const ScrollViewComponent = ScrollView as React.ComponentType<{
    flex: number
    backgroundColor: string
    contentContainerStyle: any
    style?: StyleProp<ViewStyle>
    children?: ReactNode
  }>
  return (
    <ScrollViewComponent
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom }}
      style={style}
    >
      {children}
    </ScrollViewComponent>
  )
}

export type { ScreenContainerProps }
