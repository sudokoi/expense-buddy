import "../tamagui-web.css"

import { useEffect } from "react"
import { useColorScheme } from "react-native"
import { StatusBar } from "expo-status-bar"
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native"
import { useFonts } from "expo-font"
import { SplashScreen, Stack } from "expo-router"
import { Provider } from "components/Provider"
import { useTheme } from "tamagui"
import { NotificationStack } from "../components/NotificationStack"
import { SyncIndicator } from "../components/SyncIndicator"
import { UpdateBanner } from "../components/ui/UpdateBanner"
import { ChangelogSheet } from "../components/ui/ChangelogSheet"
import { useUpdateCheck } from "../hooks/use-update-check"
import { useChangelogOnUpdate } from "../hooks/use-changelog-on-update"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { useThemeSettings } from "../stores/hooks"

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
    Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
    InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
  })

  useEffect(() => {
    if (interLoaded || interError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned) and the UI is ready.
      SplashScreen.hideAsync()
    }
  }, [interLoaded, interError])

  if (!interLoaded && !interError) {
    return null
  }

  return (
    <Providers>
      <RootLayoutNav />
    </Providers>
  )
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
    handleUpdate,
    handleDismiss,
  } = useUpdateCheck()

  const changelog = useChangelogOnUpdate({
    updateAvailable,
    updateCheckCompleted,
  })

  return (
    <>
      {showBanner && latestVersion ? (
        <UpdateBanner
          version={latestVersion}
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
  const systemScheme = useColorScheme()
  const theme = useTheme()

  // Follow the app's effective theme (settings) so StatusBar stays readable
  // even when the user forces light/dark opposite to the OS scheme.
  const { effectiveTheme, isLoading } = useThemeSettings()

  const resolvedScheme = isLoading
    ? systemScheme === "dark"
      ? "dark"
      : "light"
    : effectiveTheme

  return (
    <ThemeProvider value={resolvedScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar
        style={resolvedScheme === "dark" ? "light" : "dark"}
        backgroundColor={theme.background.val}
        translucent={false}
      />
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.background.val,
            },
          }}
        />

        <Stack.Screen
          name="github/repo-picker"
          options={{
            title: "GitHub",
            headerStyle: {
              backgroundColor: theme.background.val,
            },
            headerTintColor: theme.color.val,
            contentStyle: {
              backgroundColor: theme.background.val,
            },
          }}
        />

        <Stack.Screen
          name="day/[date]"
          options={{
            headerStyle: {
              backgroundColor: theme.background.val,
            },
            headerTintColor: theme.color.val,
            contentStyle: {
              backgroundColor: theme.background.val,
            },
          }}
        />

        <Stack.Screen
          name="modal"
          options={{
            title: "Tamagui + Expo",
            presentation: "modal",
            animation: "slide_from_right",
            gestureEnabled: true,
            gestureDirection: "horizontal",
            contentStyle: {
              backgroundColor: theme.background.val,
            },
          }}
        />
      </Stack>
    </ThemeProvider>
  )
}
