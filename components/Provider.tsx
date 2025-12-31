import { useColorScheme } from "react-native"
import { TamaguiProvider, type TamaguiProviderProps } from "tamagui"
import { ToastProvider, ToastViewport } from "@tamagui/toast"
import { CurrentToast } from "./CurrentToast"
import { config } from "../tamagui.config"
import { SettingsProvider, useSettings } from "../context/SettingsContext"

/**
 * Inner provider component that uses effectiveTheme from SettingsContext
 * This must be inside SettingsProvider to access the settings context
 */
function ThemedProvider({ children, ...rest }: Omit<TamaguiProviderProps, "config">) {
  const { effectiveTheme, isLoading } = useSettings()
  const systemColorScheme = useColorScheme()

  // Use effectiveTheme from settings context, fallback to system during loading
  const theme = isLoading
    ? systemColorScheme === "dark"
      ? "dark"
      : "light"
    : effectiveTheme

  return (
    <TamaguiProvider config={config} defaultTheme={theme} {...rest}>
      <ToastProvider
        swipeDirection="horizontal"
        duration={6000}
        native={
          [
            // uncomment the next line to do native toasts on mobile. NOTE: it'll require you making a dev build and won't work with Expo Go
            // 'mobile'
          ]
        }
      >
        {children}
        <CurrentToast />
        <ToastViewport top="$8" left={0} right={0} />
      </ToastProvider>
    </TamaguiProvider>
  )
}

/**
 * Main Provider component that wraps the app with all necessary providers
 * SettingsProvider is the outermost to allow ThemedProvider to access settings
 */
export function Provider({ children, ...rest }: Omit<TamaguiProviderProps, "config">) {
  return (
    <SettingsProvider>
      <ThemedProvider {...rest}>{children}</ThemedProvider>
    </SettingsProvider>
  )
}
