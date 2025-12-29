import { Tabs } from "expo-router"
import { useTheme } from "tamagui"
import { Home, PlusCircle, PieChart, Clock, Settings } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getColorValue } from "../../tamagui.config"
import { ACCENT_COLORS } from "../../constants/theme-colors"

export default function TabLayout() {
  const theme = useTheme()
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
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Home color={getColorValue(color)} size={24} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add Expense",
          tabBarIcon: ({ color }) => (
            <PlusCircle color={getColorValue(color)} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <PieChart color={getColorValue(color)} size={24} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <Clock color={getColorValue(color)} size={24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={getColorValue(color)} size={24} />,
        }}
      />
    </Tabs>
  )
}
