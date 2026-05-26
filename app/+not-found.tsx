import { Link, Stack } from "expo-router"
import { StyleSheet } from "react-native"
import { View, Text } from "tamagui"
import { SEMANTIC_COLORS } from "../constants/theme-colors"
import { UI_SPACE } from "../constants/ui-tokens"

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View m={UI_SPACE.control + 2}>
        <Text>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text fontSize="$body" color={SEMANTIC_COLORS.info}>
            Go to home screen!
          </Text>
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
