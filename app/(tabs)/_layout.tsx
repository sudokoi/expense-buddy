import { Tabs, usePathname } from "expo-router"
import { useEffect } from "react"
import { useTheme } from "tamagui"
import { Home, PlusCircle, PieChart, Clock, Settings } from "@tamagui/lucide-icons-2"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { getColorValue } from "../../tamagui.config"
import { ACCENT_COLORS } from "../../constants/theme-colors"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { logAsync } from "../../services/logger"

export default function TabLayout() {
  const theme = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

  useEffect(() => {
    if (__DEV__) {
      logAsync("INFO", "NAV", `TAB_CHANGE route=${pathname}`)
    }
  }, [pathname])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT_COLORS.primary, // Kawaii pink
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
          height: 40 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        headerStyle: {
          backgroundColor: theme.background.val,
          borderBottomColor: theme.borderColor.val,
        },
        headerTintColor: theme.color.val,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.dashboard"),
          tabBarIcon: ({ color }) => (
            <Home color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t("navigation.add"),
          tabBarIcon: ({ color }) => (
            <PlusCircle color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t("navigation.analytics"),
          tabBarIcon: ({ color }) => (
            <PieChart color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("navigation.history"),
          tabBarIcon: ({ color }) => (
            <Clock color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("navigation.settings"),
          tabBarIcon: ({ color }) => (
            <Settings color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
    </Tabs>
  )
}
