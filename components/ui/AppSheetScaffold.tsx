import type { ReactNode } from "react"
import type { ViewStyle } from "react-native"
import { useTranslation } from "react-i18next"
import { Button, H4, Sheet, Text, XStack, YStack, ScrollView } from "tamagui"
import { X } from "@tamagui/lucide-icons"

const layoutStyles = {
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
} as const

type AppSheetScaffoldProps = {
  open: boolean
  onClose: () => void

  title: ReactNode
  subtitle?: ReactNode

  snapPoints: number[]
  dismissOnSnapToBottom?: boolean

  /** When true, returns null when closed (perf). */
  unmountWhenClosed?: boolean

  /** Wraps body content in a ScrollView. */
  scroll?: boolean

  /** Optional footer pinned under body content. */
  footer?: ReactNode

  /** Additional styles applied to Sheet.Frame (after default padding). */
  frameStyle?: ViewStyle | ViewStyle[]

  children: ReactNode
}

export function AppSheetScaffold({
  open,
  onClose,
  title,
  subtitle,
  snapPoints,
  dismissOnSnapToBottom = true,
  unmountWhenClosed = false,
  scroll = false,
  footer,
  frameStyle,
  children,
}: AppSheetScaffoldProps) {
  const { t } = useTranslation()

  if (!open && unmountWhenClosed) {
    return null
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) onClose()
      }}
      snapPoints={snapPoints}
      dismissOnSnapToBottom={dismissOnSnapToBottom}
    >
      <Sheet.Overlay />
      <Sheet.Frame style={[{ padding: 16 } as ViewStyle, frameStyle]} bg="$background">
        <Sheet.Handle />

        <YStack gap="$4" mt={8} flex={1}>
          <XStack style={layoutStyles.headerRow}>
            <YStack>
              <H4>{title}</H4>
              {subtitle ? (
                <Text fontSize="$3" opacity={0.7} color="$color">
                  {subtitle}
                </Text>
              ) : null}
            </YStack>

            <Button
              size="$3"
              chromeless
              icon={X}
              onPress={onClose}
              aria-label={t("common.close")}
            />
          </XStack>

          {scroll ? (
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            children
          )}

          {footer ? <YStack gap="$2">{footer}</YStack> : null}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export type { AppSheetScaffoldProps }
