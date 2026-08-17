import { useColorScheme } from "nativewind"
import { palette, type ThemeScheme } from "../constants/palette"

/**
 * Resolved semantic theme colors for the active color scheme.
 *
 * Uses NativeWind's `useColorScheme`, which reflects the scheme set at the app
 * root from the user's theme preference (light/dark/system). Returns the
 * `palette` entry so callers can read `background`, `foreground`, `accent`,
 * etc. directly.
 */
export function useThemeColors() {
  const { colorScheme } = useColorScheme()
  return palette[colorScheme === "dark" ? "dark" : "light"]
}

/**
 * Returns the current scheme ("light" | "dark"), for callers that only need
 * the mode (e.g. chart/overlay color selectors).
 */
export function useThemeScheme(): ThemeScheme {
  const { colorScheme } = useColorScheme()
  return colorScheme === "dark" ? "dark" : "light"
}
