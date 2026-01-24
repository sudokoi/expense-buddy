import { Anchor, Paragraph, View, XStack } from "tamagui"
import { ACCENT_COLORS } from "../constants/theme-colors"
import { useTranslation } from "react-i18next"

export default function ModalScreen() {
  const { t } = useTranslation()
  return (
    <View flex={1} items="center" justify="center">
      <XStack gap="$2">
        <Paragraph text="center">{t("common.madeBy")}</Paragraph>
        <Anchor
          color={ACCENT_COLORS.primary}
          href="https://twitter.com/natebirdman"
          target="_blank"
        >
          @natebirdman,
        </Anchor>
        <Anchor
          color={ACCENT_COLORS.primaryDark}
          href="https://github.com/tamagui/tamagui"
          target="_blank"
          rel="noreferrer"
        >
          {t("common.giveStar")}
        </Anchor>
      </XStack>
    </View>
  )
}
