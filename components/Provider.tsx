import { useEffect } from "react"
import { useColorScheme } from "nativewind"
import { StoreProvider } from "../stores/store-provider"
import { DerivedExpenseDataProvider } from "../stores/hooks/use-derived-expense-data"
import { useThemeSettings } from "../stores/hooks"
import { SmsImportReviewProvider } from "../providers/sms-import-review-provider"

/**
 * Inner provider that drives NativeWind's color scheme from the user's theme
 * preference. This must be inside StoreProvider to access the settings.
 */
function ThemedProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useColorScheme()
  const { effectiveTheme, isLoading } = useThemeSettings()

  useEffect(() => {
    if (!isLoading) {
      setColorScheme(effectiveTheme)
    }
  }, [effectiveTheme, isLoading, setColorScheme])

  return <>{children}</>
}

/**
 * Main Provider component that wraps the app with all necessary providers.
 * StoreProvider is the outermost to allow ThemedProvider to access settings.
 */
export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <DerivedExpenseDataProvider>
        <SmsImportReviewProvider>
          <ThemedProvider>{children}</ThemedProvider>
        </SmsImportReviewProvider>
      </DerivedExpenseDataProvider>
    </StoreProvider>
  )
}
