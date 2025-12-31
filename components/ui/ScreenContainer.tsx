import { ScrollView } from "tamagui"
import { ReactNode, memo } from "react"
import { StyleProp, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface ScreenContainerProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * ScreenContainer - A styled ScrollView for consistent screen layouts
 * Provides consistent background color and padding with safe area support
 * Memoized to prevent unnecessary re-renders
 */
export const ScreenContainer = memo(function ScreenContainer({
  children,
  style,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      flex={1}
      bg="$background"
      contentContainerStyle={
        { padding: 16, paddingBottom: insets.bottom } as React.ComponentProps<
          typeof ScrollView
        >["contentContainerStyle"]
      }
      style={style}
    >
      {children}
    </ScrollView>
  )
})

export type { ScreenContainerProps }
