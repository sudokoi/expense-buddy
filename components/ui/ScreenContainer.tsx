import { ScrollView } from "tamagui"
import { ReactNode, memo } from "react"
import { StyleProp, StyleSheet, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { UI_SPACE } from "../../constants/ui-tokens"

interface ScreenContainerProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
}

/**
 * ScreenContainer - A styled ScrollView for consistent screen layouts
 * Provides consistent background color and padding with safe area support
 * Memoized to prevent unnecessary re-renders
 */
export const ScreenContainer = memo(function ScreenContainer({
  children,
  style,
  contentContainerStyle,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets()
  const resolvedContentContainerStyle = StyleSheet.flatten([
    {
      padding: UI_SPACE.gutter,
      paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter),
    },
    contentContainerStyle,
  ])
  const tamaguiContentContainerStyle =
    resolvedContentContainerStyle as React.ComponentProps<typeof ScrollView>["contentContainerStyle"]

  return (
    <ScrollView
      flex={1}
      bg="$background"
      contentContainerStyle={tamaguiContentContainerStyle}
      style={style}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
})

export type { ScreenContainerProps }
