import { Link, Stack } from "expo-router"
import { StyleSheet, View, Text } from "react-native"
import { UI_SPACE } from "../constants/ui-tokens"

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="m-2.5">
        <Text>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text className="text-[13px] text-info">Go to home screen!</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  link: {
    marginTop: UI_SPACE.gutter - 1,
    paddingVertical: UI_SPACE.gutter - 1,
  },
})
