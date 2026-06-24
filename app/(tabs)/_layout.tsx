import { Tabs } from "expo-router"
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT_COLORS.primary,
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
        listeners={{
          tabPress: () => logAsync("INFO", "UI_ACTION", "TAB_DASHBOARD"),
        }}
        options={{
          title: t("navigation.dashboard"),
          tabBarIcon: ({ color }) => (
            <Home color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        listeners={{
          tabPress: () => logAsync("INFO", "UI_ACTION", "TAB_ADD"),
        }}
        options={{
          title: t("navigation.add"),
          tabBarIcon: ({ color }) => (
            <PlusCircle color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        listeners={{
          tabPress: () => logAsync("INFO", "UI_ACTION", "TAB_ANALYTICS"),
        }}
        options={{
          title: t("navigation.analytics"),
          tabBarIcon: ({ color }) => (
            <PieChart color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        listeners={{
          tabPress: () => logAsync("INFO", "UI_ACTION", "TAB_HISTORY"),
        }}
        options={{
          title: t("navigation.history"),
          tabBarIcon: ({ color }) => (
            <Clock color={getColorValue(color)} size={UI_ICON_SIZE.large} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        listeners={{
          tabPress: () => logAsync("INFO", "UI_ACTION", "TAB_SETTINGS"),
        }}
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
