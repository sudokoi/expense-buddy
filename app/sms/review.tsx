import { Stack, useLocalSearchParams } from "expo-router"
import { useTranslation } from "react-i18next"
import { useTheme } from "tamagui"
import { SmsImportReviewScreen } from "../../components/ui/SmsImportReviewScreen"

function pickSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value
  }

  return value?.[0] ?? null
}

export default function SmsImportReviewRoute() {
  const { t } = useTranslation()
  const theme = useTheme()
  const params = useLocalSearchParams<{ itemId?: string | string[] }>()
  const initialFocusItemId = pickSearchParam(params.itemId)

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
      <SmsImportReviewScreen initialFocusItemId={initialFocusItemId} />
    </>
  )
}
