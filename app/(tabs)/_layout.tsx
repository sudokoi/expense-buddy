import { Tabs } from "expo-router"
import { useTheme } from "tamagui"
import { Atom, AudioWaveform, Settings } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getColorValue } from "../../tamagui.config"

export default function TabLayout() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.blue10.val,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
          height: 60 + insets.bottom,
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
          tabBarIcon: ({ color }) => <Atom color={getColorValue(color)} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add Expense",
          tabBarIcon: ({ color }) => <AudioWaveform color={getColorValue(color)} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <Atom color={getColorValue(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={getColorValue(color)} />,
        }}
      />
    </Tabs>
  )
}
