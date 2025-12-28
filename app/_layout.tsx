import "../tamagui-web.css"

import { useEffect } from "react"
import { useColorScheme } from "react-native"
import { StatusBar } from "expo-status-bar"
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native"
import { useFonts } from "expo-font"
import { SplashScreen, Stack } from "expo-router"
import { Provider } from "components/Provider"
import { useTheme } from "tamagui"
import { ExpenseProvider } from "../context/ExpenseContext"

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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NotificationProvider } from "../context/notification-context"
import { SyncStatusProvider } from "../context/sync-status-context"
import { NotificationStack } from "../components/NotificationStack"
import { SyncIndicator } from "../components/SyncIndicator"
import { KeyboardProvider } from "react-native-keyboard-controller"

const queryClient = new QueryClient()

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <KeyboardProvider>
      <Provider>
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>
            <SyncStatusProvider>
              <ExpenseProvider>
                {children}
                <NotificationStack />
                <SyncIndicator />
              </ExpenseProvider>
            </SyncStatusProvider>
          </NotificationProvider>
        </QueryClientProvider>
      </Provider>
    </KeyboardProvider>
  )
}

function RootLayoutNav() {
  const colorScheme = useColorScheme()
  const theme = useTheme()
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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
