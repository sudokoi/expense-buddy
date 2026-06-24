import { useMemo } from "react"
import { Button, YStack } from "tamagui"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { MarkdownText } from "./MarkdownText"
import { useTranslation } from "react-i18next"

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
          <Button size="$control" onPress={onViewFullReleaseNotes} theme="accent">
            {t("changelog.viewFull")}
          </Button>
          <Button size="$control" onPress={onClose}>
            {t("common.close") || "Close"}
          </Button>
        </>
      }
    >
      <YStack style={{ paddingBottom: 16 }}>
        <MarkdownText>{normalizedNotes}</MarkdownText>
      </YStack>
    </AppSheetScaffold>
  )
}

export type { ChangelogSheetProps }
