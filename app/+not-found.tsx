import { Link, Stack } from "expo-router"
import { StyleSheet } from "react-native"
import { View, Text } from "tamagui"
import { SEMANTIC_COLORS } from "../constants/theme-colors"
import { UI_SPACE } from "../constants/ui-tokens"

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View m={10}>
        <Text>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: UI_SPACE.control,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: UI_SPACE.gutter - 1,
    paddingVertical: UI_SPACE.gutter - 1,
  },
  linkText: {
    fontSize: 14,
    color: SEMANTIC_COLORS.info,
  },
})
