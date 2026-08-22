import type { ThemePreference } from "../services/settings-manager"
import type { ThemeScheme } from "../constants/palette"

/**
 * Pure predicate: has the stored preference become visible in NativeWind's
 * resolved scheme?
 *
 * Forced preferences ("light"/"dark") are forwarded verbatim by ThemedProvider,
 * so the resolved scheme must eventually equal them — but NativeWind applies
 * the native override asynchronously, so this flips false→true a frame or more
 * after launch. "system" always settles immediately: its resolution belongs to
 * NativeWind and the OS, never to JS.
 */
export function isThemeSettled(
  preference: ThemePreference,
  resolved: ThemeScheme
): boolean {
  return preference === "system" || preference === resolved
}
