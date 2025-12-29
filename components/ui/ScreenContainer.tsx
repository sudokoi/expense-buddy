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

  return (
    <ScrollView
      flex={1}
      bg="$background"
      contentContainerStyle={
        { padding: 8, paddingBottom: 8 + insets.bottom } as React.ComponentProps<
          typeof ScrollView
        >["contentContainerStyle"]
      }
      style={style}
    >
      {children}
    </ScrollView>
  )
}

export type { ScreenContainerProps }
