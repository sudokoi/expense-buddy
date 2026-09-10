import { Link, Stack } from "expo-router"
import { View, Text } from "react-native"
import { useTranslation } from "react-i18next"
import { useDisplayDensity } from "../hooks/use-display-density"

export default function NotFoundScreen() {
  const { t } = useTranslation()
  const { space } = useDisplayDensity()
  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <View className="m-2.5">
        <Text className="text-default text-foreground">{t("notFound.message")}</Text>
        <Link
          href="/"
          style={{ marginTop: space.gutter - 1, paddingVertical: space.gutter - 1 }}
        >
          <Text className="text-body text-info">{t("notFound.goHome")}</Text>
        </Link>
      </View>
    </>
  )
}
