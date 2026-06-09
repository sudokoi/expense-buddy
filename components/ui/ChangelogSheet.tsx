import { useMemo } from "react"
import Markdown from "react-native-markdown-display"
import { Button, useTheme, YStack } from "tamagui"
import { AppSheetScaffold } from "./AppSheetScaffold"
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
  const theme = useTheme()
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
      <YStack pb="$gutter">
        <Markdown
          style={{
            body: {
              fontSize: 14,
              lineHeight: 22,
              color: theme.color.val,
            },
            heading1: { fontSize: 20, fontWeight: "700" as const, marginBottom: 8 },
            heading2: { fontSize: 17, fontWeight: "600" as const, marginBottom: 6 },
            heading3: { fontSize: 15, fontWeight: "600" as const, marginBottom: 4 },
            heading4: { fontSize: 14, fontWeight: "600" as const },
            heading5: { fontSize: 13, fontWeight: "600" as const },
            heading6: { fontSize: 13, fontWeight: "600" as const },
            bullet_list: { marginBottom: 8 },
            ordered_list: { marginBottom: 8 },
            list_item: { marginBottom: 4 },
            fence: {
              backgroundColor: theme.backgroundHover.val,
              padding: 8,
              borderRadius: 6,
              marginVertical: 6,
              fontFamily: "monospace",
              fontSize: 12,
            },
            code_inline: {
              backgroundColor: theme.backgroundHover.val,
              fontFamily: "monospace",
              fontSize: 12,
              paddingHorizontal: 4,
              borderRadius: 3,
            },
            link: {
              color: theme.colorFocus.val,
              textDecorationLine: "underline" as const,
            },
            blockquote: {
              borderLeftWidth: 3,
              borderLeftColor: theme.borderColorFocus.val,
              paddingLeft: 10,
              marginVertical: 6,
              opacity: 0.8,
            },
            hr: {
              marginVertical: 10,
              backgroundColor: theme.borderColor.val,
              height: 1,
            },
          }}
        >
          {normalizedNotes}
        </Markdown>
      </YStack>
    </AppSheetScaffold>
  )
}

export type { ChangelogSheetProps }
