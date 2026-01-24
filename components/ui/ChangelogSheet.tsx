import { useMemo } from "react"
import { Platform, TextStyle } from "react-native"
import { Button, Text, YStack } from "tamagui"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"

const layoutStyles = {
  notesText: {
    ...(Platform.OS === "web" ? ({ whiteSpace: "pre-wrap" } as any) : undefined),
  } as TextStyle,
} as const

interface ChangelogSheetProps {
  open: boolean
  version: string
  releaseNotes: string
  onClose: () => void
  onViewFullReleaseNotes: () => void
}

export function ChangelogSheet({
  open,
  version,
  releaseNotes,
  onClose,
  onViewFullReleaseNotes,
}: ChangelogSheetProps) {
  const { t } = useTranslation()
  const normalizedNotes = useMemo(
    () => releaseNotes.replace(/\r\n/g, "\n"),
    [releaseNotes]
  )

  return (
    <AppSheetScaffold
      open={open}
      onClose={onClose}
      title={t("changelog.title")}
      subtitle={t("changelog.subtitle", { version })}
      snapPoints={[85]}
      unmountWhenClosed
      scroll
      footer={
        <>
          <Button size="$4" onPress={onViewFullReleaseNotes} themeInverse>
            {t("changelog.viewFull")}
          </Button>
          <Button size="$4" onPress={onClose}>
            {t("common.close") || "Close"}
          </Button>
        </>
      }
    >
      <YStack pb="$4">
        <Text fontSize="$4" lineHeight={22} color="$color" style={layoutStyles.notesText}>
          {normalizedNotes}
        </Text>
      </YStack>
    </AppSheetScaffold>
  )
}

export type { ChangelogSheetProps }
