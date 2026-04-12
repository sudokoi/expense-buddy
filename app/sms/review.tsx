import { Stack } from "expo-router"
import { useTranslation } from "react-i18next"
import { useTheme } from "tamagui"
import { SmsImportReviewScreen } from "../../components/ui/SmsImportReviewScreen"

export default function SmsImportReviewRoute() {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <>
      <Stack.Screen
        options={{
          title: t("smsImport.sheet.title"),
          headerStyle: {
            backgroundColor: theme.background.val,
          },
          headerTintColor: theme.color.val,
          contentStyle: {
            backgroundColor: theme.background.val,
          },
        }}
      />
      <SmsImportReviewScreen />
    </>
  )
}
