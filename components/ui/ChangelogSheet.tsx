import { useMemo } from "react"
import { Platform, ViewStyle } from "react-native"
import { Button, Text, YStack } from "tamagui"
import { AppSheetScaffold } from "./AppSheetScaffold"

const layoutStyles = {
  notesText: {
    ...(Platform.OS === "web" ? ({ whiteSpace: "pre-wrap" } as any) : undefined),
  } as ViewStyle,
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
  const normalizedNotes = useMemo(
    () => releaseNotes.replace(/\r\n/g, "\n"),
    [releaseNotes]
  )

  return (
    <AppSheetScaffold
      open={open}
      onClose={onClose}
      title={"What's New"}
      subtitle={`Version ${version}`}
      snapPoints={[85]}
      unmountWhenClosed
      scroll
      footer={
        <>
          <Button size="$4" onPress={onViewFullReleaseNotes} themeInverse>
            View full release notes
          </Button>
          <Button size="$4" onPress={onClose}>
            Close
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
