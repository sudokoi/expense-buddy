import "../global.css"

import { useEffect, useMemo } from "react"
import { useColorScheme as useNativeWindColorScheme } from "nativewind"
import { StatusBar } from "expo-status-bar"
import * as SystemUI from "expo-system-ui"
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
import { useThemeColors } from "../hooks/use-theme-colors"
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

export default function RootLayout() {
  const [interLoaded, interError] = useFonts({
    Inter: require("../assets/fonts/Inter-Medium.otf"),
    InterBold: require("../assets/fonts/Inter-Bold.otf"),
  })

  const fontsReady = Boolean(interLoaded || interError)

  if (!fontsReady) {
    return null
  }

  return (
    <Providers>
      <AppSplashGate fontsReady={fontsReady} />
      <RootLayoutNav />
    </Providers>
  )
}

/**
 * Keeps the native splash visible until fonts are ready and the persisted
 * theme has been applied. With the MMKV sync fast-path settings resolve on
 * the first tick; without it (first launch or pre-migration) it waits for
 * the async load. ThemedProvider applies the theme in a layout effect before
 * the paint that follows, so once isLoading clears the first visible frame
 * already uses the correct theme.
 */
function AppSplashGate({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useSettings()

  useEffect(() => {
    if (!fontsReady) return
    if (isLoading) return
    void SplashScreen.hideAsync()
  }, [fontsReady, isLoading])

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
