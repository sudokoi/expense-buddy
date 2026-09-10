import { Tabs, usePathname } from "expo-router"
import { PlatformPressable } from "expo-router/react-navigation"
import { useEffect } from "react"
import { View } from "react-native"
import { PlusCircle, PieChart, Clock, Settings } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { useTabBarHeight } from "../../hooks/use-tab-bar-height"
import { UI_FONT_SIZE, UI_FONT_WEIGHT, UI_SPACE } from "../../constants/ui-tokens"
import { logAsync } from "../../services/logger"
import { useDisplayDensity } from "../../hooks/use-display-density"

export default function TabLayout() {
  const theme = useThemeColors()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useTabBarHeight()
  const { layout, icon, density, font } = useDisplayDensity()
  const pathname = usePathname()

  useEffect(() => {
    if (__DEV__) {
      logAsync("INFO", "NAV", `TAB_CHANGE route=${pathname}`)
    }
  }, [pathname])

  return (
    <Tabs
      screenOptions={{
        animation: "none",
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            pressColor="transparent"
            pressOpacity={1}
            android_ripple={{ color: "transparent" }}
          />
        ),
        tabBarActiveTintColor: theme.accent,
        tabBarShowLabel: true,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: UI_FONT_SIZE.caption,
          fontWeight: UI_FONT_WEIGHT.semiBold,
        },
        // Navigator slot, not a touch target: leaves room for wide platform tab glyphs.
        tabBarIconStyle: { width: layout.tabSlotWidth, height: layout.tabSlotHeight },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: tabBarHeight,
          paddingTop: UI_SPACE.micro,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
        headerTintColor: theme.foreground,
        headerTitleStyle: density === "compact" ? { fontSize: font.screen } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.analytics"),
          tabBarIcon: ({ color, focused }) => (
            <View
              className="w-layout-tabSlotWidth items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <PieChart color={color} size={icon.large} />
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
              className="w-layout-tabSlotWidth items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <PlusCircle color={color} size={icon.large} />
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
              className="w-layout-tabSlotWidth items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <Clock color={color} size={icon.large} />
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
              className="w-layout-tabSlotWidth items-center rounded-full py-1"
              style={focused ? { backgroundColor: theme.muted } : undefined}
            >
              <Settings color={color} size={icon.large} />
            </View>
          ),
        }}
      />
    </Tabs>
  )
}
