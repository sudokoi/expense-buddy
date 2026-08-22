import { useColorScheme } from "nativewind"
import { palette, type ThemeScheme } from "../constants/palette"
import { useSettings } from "../stores/hooks"
import { isThemeSettled } from "../utils/theme"

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

/**
 * Reactive form of {@link isThemeSettled}. False while settings are loading —
 * the persisted preference isn't known yet, so nothing can be settled.
 */
export function useThemeSettled(): boolean {
  const { colorScheme } = useColorScheme()
  const { settings, isLoading } = useSettings()
  return (
    !isLoading &&
    isThemeSettled(settings.theme, colorScheme === "dark" ? "dark" : "light")
  )
}
