import { Tabs, usePathname } from "expo-router"
import { useEffect } from "react"
import { Pressable } from "react-native"
import { PlusCircle, PieChart, Clock, Settings } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { logAsync } from "../../services/logger"
import type { BottomTabBarButtonProps } from "expo-router/build/react-navigation/bottom-tabs"

function TabBarButton({
  children,
  style,
  onPress,
  onLongPress,
  href: _href,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  ref: _ref,
  ...rest
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={null}
      style={({ pressed }) => [
        style,
        { flex: 1, alignItems: "center", justifyContent: "center" },
        pressed && { opacity: 0.55 },
      ]}
    >
      {children}
    </Pressable>
  )
}

export default function TabLayout() {
  const theme = useThemeColors()
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
        tabBarActiveTintColor: theme.accent,
        tabBarShowLabel: false,
        tabBarButton: TabBarButton,
        tabBarItemStyle: {
          // Force the button to be centered in each tab item; the default
          // uikit layout top-aligns content when labels are hidden.
          alignItems: "center",
          justifyContent: "center",
        },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 40 + insets.bottom,
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
          tabBarIcon: ({ color }) => <PieChart color={color} size={UI_ICON_SIZE.large} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t("navigation.add"),
          tabBarIcon: ({ color }) => (
            <PlusCircle color={color} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("navigation.history"),
          tabBarIcon: ({ color }) => <Clock color={color} size={UI_ICON_SIZE.large} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("navigation.settings"),
          tabBarIcon: ({ color }) => <Settings color={color} size={UI_ICON_SIZE.large} />,
        }}
      />
    </Tabs>
  )
}
