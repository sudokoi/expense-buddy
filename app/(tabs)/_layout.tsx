import { Link, Tabs } from 'expo-router'
import { Button, useTheme } from 'tamagui'
import { Atom, AudioWaveform } from '@tamagui/lucide-icons'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.blue10.val,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
          height: 60,
          paddingBottom: 10,
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
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Atom color={color as any} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add Expense',
          tabBarIcon: ({ color }) => <AudioWaveform color={color as any} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Atom color={color as any} />,
        }}
      />
    </Tabs>
  )
}
