import { useMemo } from "react"
import { Platform, ViewStyle } from "react-native"
import { Button, H4, ScrollView, Sheet, Text, XStack, YStack } from "tamagui"
import { X } from "@tamagui/lucide-icons"

const layoutStyles = {
  sheetFrame: {
    padding: 16,
  } as ViewStyle,
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
  contentContainer: {
    marginTop: 8,
    flex: 1,
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

  if (!open) {
    return null
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) onClose()
      }}
      snapPoints={[85]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame style={layoutStyles.sheetFrame} bg="$background">
        <Sheet.Handle />

        <YStack gap="$4" style={layoutStyles.contentContainer}>
          <XStack style={layoutStyles.headerRow}>
            <YStack>
              <H4>What&apos;s New</H4>
              <Text fontSize="$3" opacity={0.7} color="$color">
                Version {version}
              </Text>
            </YStack>

            <Button size="$3" chromeless icon={X} onPress={onClose} aria-label="Close" />
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            <YStack pb="$4">
              <Text
                fontSize="$4"
                lineHeight={22}
                color="$color"
                style={
                  Platform.OS === "web" ? ({ whiteSpace: "pre-wrap" } as any) : undefined
                }
              >
                {normalizedNotes}
              </Text>
            </YStack>
          </ScrollView>

          <YStack gap="$2">
            <Button size="$4" onPress={onViewFullReleaseNotes} themeInverse>
              View full release notes
            </Button>
            <Button size="$4" onPress={onClose}>
              Close
            </Button>
          </YStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export type { ChangelogSheetProps }
