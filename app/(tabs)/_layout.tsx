import { Tabs } from "expo-router"
import { useTheme } from "tamagui"
import { Home, PlusCircle, PieChart, Clock, Settings } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { getColorValue } from "../../tamagui.config"
import { ACCENT_COLORS } from "../../constants/theme-colors"

export default function TabLayout() {
  const theme = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

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
          tabBarIcon: ({ color }) => <Home color={getColorValue(color)} size={24} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t("navigation.add"),
          tabBarIcon: ({ color }) => (
            <PlusCircle color={getColorValue(color)} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t("navigation.analytics"),
          tabBarIcon: ({ color }) => <PieChart color={getColorValue(color)} size={24} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("navigation.history"),
          tabBarIcon: ({ color }) => <Clock color={getColorValue(color)} size={24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("navigation.settings"),
          tabBarIcon: ({ color }) => <Settings color={getColorValue(color)} size={24} />,
        }}
      />
    </Tabs>
  )
}
