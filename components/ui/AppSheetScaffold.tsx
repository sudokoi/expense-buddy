import type { ReactNode } from "react"
import type { ViewStyle } from "react-native"
import { useTranslation } from "react-i18next"
import { H4, Sheet, Text, XStack, YStack, ScrollView } from "tamagui"
import { X } from "@tamagui/lucide-icons-2"
import { UI_SPACE, UI_OPACITY, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { IconActionButton } from "./IconActionButton"

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
      <Sheet.Frame style={[{ padding: UI_SPACE.gutter }, frameStyle]} bg="$background">
        <Sheet.Handle />

        <YStack gap="$gutter" mt={UI_SPACE.control} flex={1}>
          <XStack justify="space-between" items="center">
            <YStack>
              <H4>{title}</H4>
              {subtitle ? (
                <Text fontSize="$body" opacity={UI_OPACITY.medium} color="$color">
                  {subtitle}
                </Text>
              ) : null}
            </YStack>

            <IconActionButton
              icon={<X size={UI_ICON_SIZE.medium} />}
              onPress={onClose}
              tooltip={t("common.close")}
              accessibilityLabel={t("common.close")}
            />
          </XStack>

          {scroll ? (
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            children
          )}

          {footer ? <YStack gap="$control">{footer}</YStack> : null}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}

export type { AppSheetScaffoldProps }
