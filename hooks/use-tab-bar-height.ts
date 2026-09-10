import { useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useDisplayDensity } from "./use-display-density"
import { densityTabHeight } from "../constants/display-density"

/** Shared by the tab layout and keyboard-sticky actions that sit above the tabs. */
export function useTabBarHeight() {
  const { fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { density } = useDisplayDensity()
  return densityTabHeight(density, fontScale, insets.bottom)
}
