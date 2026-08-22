import "../global.css"

import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import {
  useColorScheme as useNativeWindColorScheme,
  colorScheme as nativeWindColorScheme,
} from "nativewind"
import { StatusBar } from "expo-status-bar"
import * as SystemUI from "expo-system-ui"
import { loadSettingsSync } from "../services/settings-manager"
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation"
import { useFonts } from "expo-font"
import { SplashScreen, Stack } from "expo-router"
import { Provider } from "../components/Provider"
import { NotificationStack } from "../components/NotificationStack"
import { SyncIndicator } from "../components/SyncIndicator"
import { UpdateBanner } from "../components/ui/UpdateBanner"
import { ChangelogSheet } from "../components/ui/ChangelogSheet"
import { useUpdateCheck } from "../hooks/use-update-check"
import { useChangelogOnUpdate } from "../hooks/use-changelog-on-update"
import { usePlayStoreReview } from "../hooks/use-play-store-review"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { useSettings } from "../stores/hooks"
import { useThemeColors, useThemeSplashGate } from "../hooks/use-theme-colors"
import { palette } from "../constants/palette"

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router"

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

// Synchronously apply the persisted theme preference before the first React
// commit, so the first JS paint behind the native splash already matches the
// user's chosen preference (dark/light). NativeWind's `colorScheme.set` drives
// `Appearance.setColorScheme` via react-native-css-interop
// (appearance-observables.js) and flips the `.dark` class that backs
// `global.css` + `palette`. This runs at module load, ~200ms earlier than
// `ThemedProvider`'s `useLayoutEffect`, which was previously gated on
// `fontsReady` and `isLoading`.
function applyPersistedThemeSynchronously(): void {
  try {
    const stored = loadSettingsSync()
    if (stored?.theme) {
      // Forward raw preference - NativeWind maps light/dark to native
      // night-mode override, "system" to follow-system. Never resolve
      // "system" here.
      nativeWindColorScheme.set(stored.theme)
    }
  } catch {
    // Sync read can fail when MMKV is unavailable (e.g. Expo Go / tests) -
    // fall back to ThemedProvider's async path which handles isLoading.
  }
}

applyPersistedThemeSynchronously()

export default function RootLayout() {
  const [interLoaded, interError] = useFonts({
    Inter: require("../assets/fonts/Inter-Medium.otf"),
    InterBold: require("../assets/fonts/Inter-Bold.otf"),
  })

  const fontsReady = Boolean(interLoaded || interError)

  // Always mount Providers behind the native splash - the early return
  // previously delayed `ThemedProvider`'s `setColorScheme` until fonts
  // loaded (~100-300ms), burning AppSplashGate's 500ms budget before
  // NativeWind even started flipping.
  return (
    <Providers>
      <AppSplashGate fontsReady={fontsReady} />
      <RootLayoutNav />
    </Providers>
  )
}

/**
 * Keeps the native splash visible until fonts are ready and the persisted
 * theme preference has become visible in NativeWind's resolved scheme
 * (`useThemeSplashGate`). ThemedProvider forwards the raw preference, but
 * NativeWind applies the native override asynchronously, so holding here
 * prevents a one-frame flash of the OS theme when it differs from a forced
 * light/dark preference. "System" settles immediately — its resolution
 * belongs to NativeWind and the OS.
 *
 * The fail-open timer is armed only once settings have loaded (i.e. after
 * ThemedProvider has forwarded the preference). Arming earlier would race the
 * async settings read and burn the whole budget before NativeWind is even
 * asked to flip — reintroducing the cold-start flash it exists to prevent.
 *
 * If NativeWind never converges (upstream regression), the splash hides anyway
 * after THEME_SETTLE_TIMEOUT_MS and the app degrades to the pre-fix flash
 * instead of trapping the user on the splash.
 *
 * The early synchronous `colorScheme.set` in module scope now starts the
 * native flip during font loading, so the budget is effectively fonts +
 * timeout. Increased from 500ms -> 2000ms to cover slow devices where the
 * Appearance bridge + re-render takes >500ms (previously caused the fail-open
 * to fire while still `light` and show a light->dark flash).
 */
const THEME_SETTLE_TIMEOUT_MS = 2000

function AppSplashGate({ fontsReady }: { fontsReady: boolean }) {
  const { settled, settingsLoaded } = useThemeSplashGate()
  const [giveUpWaiting, setGiveUpWaiting] = useState(false)

  useEffect(() => {
    if (!settingsLoaded || settled) return
    const timer = setTimeout(() => setGiveUpWaiting(true), THEME_SETTLE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [settled, settingsLoaded])

  // useLayoutEffect so hide is scheduled before the next paint that would
  // otherwise show the JS `light` surface behind the splash after it lifts.
  // `useEffect` would run post-paint and could let one `light` frame leak.
  useLayoutEffect(() => {
    if (!fontsReady) return
    if (!settled && !giveUpWaiting) return
    void SplashScreen.hideAsync()
  }, [fontsReady, settled, giveUpWaiting])

  return null
}

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <KeyboardProvider>
      <Provider>
        {children}
        <NotificationStack />
        <SyncIndicator />
        <UpdateAndChangelogOverlays />
      </Provider>
    </KeyboardProvider>
  )
}

function UpdateAndChangelogOverlays() {
  const {
    updateAvailable,
    latestVersion,
    showBanner,
    updateCheckCompleted,
    isUpdateReadyToInstall,
    handleUpdate,
    handleDismiss,
  } = useUpdateCheck()

  const changelog = useChangelogOnUpdate({
    updateAvailable,
    updateCheckCompleted,
  })
  usePlayStoreReview({
    updateAvailable,
    updateCheckCompleted,
  })

  return (
    <>
      {showBanner ? (
        <UpdateBanner
          version={latestVersion}
          readyToInstall={isUpdateReadyToInstall}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />
      ) : null}

      <ChangelogSheet
        open={changelog.open}
        version={changelog.version}
        releaseNotes={changelog.releaseNotes}
        onClose={() => {
          void changelog.close()
        }}
        onViewFullReleaseNotes={() => {
          void changelog.viewFullReleaseNotes()
        }}
      />
    </>
  )
}

function RootLayoutNav() {
  const theme = useThemeColors()
  const { settings } = useSettings()

  // NativeWind's colorScheme is the single resolved source of truth — it
  // reflects the applied preference (light/dark) or the live OS scheme when
  // the preference is "system". Follow it so StatusBar and navigation stay
  // readable even when the app is forced opposite to the OS.
  const { colorScheme: resolvedScheme } = useNativeWindColorScheme()
  const scheme = resolvedScheme === "dark" ? "dark" : "light"

  const statusBarBackground =
    scheme === "dark" ? palette.dark.background : palette.light.background

  const navigationTheme = useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme
    const bg = scheme === "dark" ? palette.dark.background : palette.light.background
    return { ...base, colors: { ...base.colors, background: bg, card: bg } }
  }, [scheme])

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(statusBarBackground)
  }, [statusBarBackground])

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack key={settings.language}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        />

        <Stack.Screen
          name="github/repo-picker"
          options={{
            title: "GitHub",
            headerStyle: {
              backgroundColor: theme.background,
            },
            headerTintColor: theme.foreground,
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        />

        <Stack.Screen
          name="history/edit/[id]"
          options={{
            headerStyle: {
              backgroundColor: theme.background,
            },
            headerTintColor: theme.foreground,
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        />

        <Stack.Screen
          name="filters"
          options={{
            presentation: "modal",
            headerStyle: {
              backgroundColor: theme.background,
            },
            headerTintColor: theme.foreground,
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        />
      </Stack>
    </ThemeProvider>
  )
}
