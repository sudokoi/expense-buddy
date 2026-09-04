import { useLayoutEffect } from "react"
import { useColorScheme } from "nativewind"
import { StoreProvider } from "../stores/store-provider"
import { DerivedExpenseDataProvider } from "../stores/hooks/use-derived-expense-data"
import { useSettings } from "../stores/hooks"
import { useWidgetAssist } from "../hooks/use-widget-assist"
import { SmsImportReviewProvider } from "../providers/sms-import-review-provider"

/**
 * Inner provider that drives NativeWind's color scheme from the user's theme
 * preference. This must be inside StoreProvider to access the settings.
 * Uses useLayoutEffect so the nativewind class is applied before the first
 * paint; combined with the splash gate in RootLayout this eliminates the
 * system-theme flash when the app preference differs from the OS.
 *
 * The raw preference is forwarded unmodified: NativeWind maps "light"/"dark"
 * to a native night-mode override and "system" to follow-system mode, so the
 * OS owns system-theme detection and live tracking. Never resolve "system"
 * to a concrete value here — that would pin the override and stop the OS
 * from emitting appearance-change events.
 */
function ThemedProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useColorScheme()
  const { settings, isLoading } = useSettings()

  useLayoutEffect(() => {
    if (!isLoading) {
      setColorScheme(settings.theme)
    }
  }, [settings.theme, isLoading, setColorScheme])

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
          <ThemedProvider>
            <WidgetAssistMount />
            {children}
          </ThemedProvider>
        </SmsImportReviewProvider>
      </DerivedExpenseDataProvider>
    </StoreProvider>
  )
}

function WidgetAssistMount() {
  useWidgetAssist()
  return null
}
