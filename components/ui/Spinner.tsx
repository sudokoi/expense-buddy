import { ActivityIndicator, type ActivityIndicatorProps } from "react-native"
import { useThemeColors } from "../../hooks/use-theme-colors"

export function Spinner(props: ActivityIndicatorProps) {
  const theme = useThemeColors()
  return <ActivityIndicator color={theme.accent} {...props} />
}
