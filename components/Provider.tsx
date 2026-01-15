import { useColorScheme } from "react-native"
import { TamaguiProvider, type TamaguiProviderProps } from "tamagui"
import { config } from "../tamagui.config"
import { StoreProvider } from "../stores/store-provider"
import { useThemeSettings } from "../stores/hooks"

/**
 * Inner provider component that uses effectiveTheme from settings store
 * This must be inside StoreProvider to access the settings
 */
function ThemedProvider({ children, ...rest }: Omit<TamaguiProviderProps, "config">) {
  const { effectiveTheme, isLoading } = useThemeSettings()
  const systemColorScheme = useColorScheme()

  // Use effectiveTheme from settings store, fallback to system during loading
  const theme = isLoading
    ? systemColorScheme === "dark"
      ? "dark"
      : "light"
    : effectiveTheme

  return (
    <TamaguiProvider config={config} defaultTheme={theme} {...rest}>
      {children}
    </TamaguiProvider>
  )
}

/**
 * Main Provider component that wraps the app with all necessary providers
 * StoreProvider is the outermost to allow ThemedProvider to access settings
 */
export function Provider({ children, ...rest }: Omit<TamaguiProviderProps, "config">) {
  return (
    <StoreProvider>
      <ThemedProvider {...rest}>{children}</ThemedProvider>
    </StoreProvider>
  )
}
