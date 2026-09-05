import { Link, Stack } from "expo-router"
import { StyleSheet, View, Text } from "react-native"
import { useTranslation } from "react-i18next"
import { UI_SPACE } from "../constants/ui-tokens"

export default function NotFoundScreen() {
  const { t } = useTranslation()
  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <View className="m-2.5">
        <Text className="text-foreground">{t("notFound.message")}</Text>
        <Link href="/" style={styles.link}>
          <Text className="text-body text-info">{t("notFound.goHome")}</Text>
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
