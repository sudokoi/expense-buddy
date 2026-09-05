import { Tabs, usePathname } from "expo-router"
import { useEffect } from "react"
import { View, useWindowDimensions } from "react-native"
import { PlusCircle, PieChart, Clock, Settings } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_FONT_SIZE, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { logAsync } from "../../services/logger"

export default function TabLayout() {
  const theme = useThemeColors()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { fontScale } = useWindowDimensions()
  const pathname = usePathname()

  useEffect(() => {
    if (__DEV__) {
      logAsync("INFO", "NAV", `TAB_CHANGE route=${pathname}`)
    }
  }, [pathname])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarShowLabel: true,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: { fontSize: UI_FONT_SIZE.caption, fontWeight: "600" },
        tabBarIconStyle: { width: 56, height: 32 },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 64 + Math.max(0, fontScale - 1) * 24 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
        headerTintColor: theme.foreground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.analytics"),
          tabBarIcon: ({ color, focused }) => (
            <View
              className="w-14 items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <PieChart color={color} size={UI_ICON_SIZE.large} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t("navigation.add"),
          tabBarLabel: t("navigation.addTab"),
          tabBarIcon: ({ color, focused }) => (
            <View
              className="w-14 items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <PlusCircle color={color} size={UI_ICON_SIZE.large} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("navigation.history"),
          tabBarIcon: ({ color, focused }) => (
            <View
              className="w-14 items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <Clock color={color} size={UI_ICON_SIZE.large} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("navigation.settings"),
          tabBarIcon: ({ color, focused }) => (
            <View
              className="w-14 items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <Settings color={color} size={UI_ICON_SIZE.large} />
            </View>
          ),
        }}
      />
    </Tabs>
  )
}
