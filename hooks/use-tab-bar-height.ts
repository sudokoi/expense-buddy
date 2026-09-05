import { useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/** Shared by the tab layout and keyboard-sticky actions that sit above the tabs. */
export function useTabBarHeight() {
  const { fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  return 64 + Math.max(0, fontScale - 1) * 24 + insets.bottom
}
