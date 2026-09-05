import { useMemo } from "react"
import Markdown from "react-native-markdown-display"
import { View } from "react-native"
import { Button } from "./Button"
import { AppSheetScaffold } from "./AppSheetScaffold"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import {
  UI_FONT_SIZE,
  UI_FONT_WEIGHT,
  UI_SPACE,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"

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
  const theme = useThemeColors()
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
          <Button size="control" variant="accent" onPress={onViewFullReleaseNotes}>
            {t("changelog.viewFull")}
          </Button>
          <Button size="control" onPress={onClose}>
            {t("common.close")}
          </Button>
        </>
      }
    >
      <View className="pb-4">
        <Markdown
          // Markdown-only geometry: 22dp line boxes, 6/3dp code corners and
          // 6/10dp rhythm keep dense release notes distinct from form controls.
          style={{
            body: {
              fontSize: UI_FONT_SIZE.label,
              lineHeight: 22,
              color: theme.foreground,
            },
            heading1: {
              fontSize: UI_FONT_SIZE.screen,
              fontWeight: UI_FONT_WEIGHT.bold,
              marginBottom: UI_SPACE.control,
            },
            heading2: {
              fontSize: UI_FONT_SIZE.section,
              fontWeight: UI_FONT_WEIGHT.semiBold,
              marginBottom: 6,
            },
            heading3: {
              fontSize: UI_FONT_SIZE.title,
              fontWeight: UI_FONT_WEIGHT.semiBold,
              marginBottom: UI_SPACE.micro,
            },
            heading4: {
              fontSize: UI_FONT_SIZE.label,
              fontWeight: UI_FONT_WEIGHT.semiBold,
            },
            heading5: {
              fontSize: UI_FONT_SIZE.body,
              fontWeight: UI_FONT_WEIGHT.semiBold,
            },
            heading6: {
              fontSize: UI_FONT_SIZE.body,
              fontWeight: UI_FONT_WEIGHT.semiBold,
            },
            bullet_list: { marginBottom: UI_SPACE.control },
            ordered_list: { marginBottom: UI_SPACE.control },
            list_item: { marginBottom: UI_SPACE.micro },
            fence: {
              backgroundColor: theme.surface,
              padding: UI_SPACE.control,
              borderRadius: 6,
              marginVertical: 6,
              fontFamily: "monospace",
              fontSize: UI_FONT_SIZE.caption,
            },
            code_inline: {
              backgroundColor: theme.surface,
              fontFamily: "monospace",
              fontSize: UI_FONT_SIZE.caption,
              paddingHorizontal: UI_SPACE.micro,
              borderRadius: 3,
            },
            link: {
              color: theme.accent,
              textDecorationLine: "underline" as const,
            },
            blockquote: {
              borderLeftWidth: UI_BORDER_WIDTH.thick,
              borderLeftColor: theme.accent,
              paddingLeft: 10,
              marginVertical: 6,
            },
            hr: {
              marginVertical: 10,
              backgroundColor: theme.border,
              height: UI_BORDER_WIDTH.thin,
            },
          }}
        >
          {normalizedNotes}
        </Markdown>
      </View>
    </AppSheetScaffold>
  )
}

export type { ChangelogSheetProps }
