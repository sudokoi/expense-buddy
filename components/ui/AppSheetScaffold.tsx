import type { ReactNode } from "react"
import { useEffect } from "react"
import type { ViewStyle } from "react-native"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { Text } from "react-native"
import { X } from "lucide-react-native"
import { UI_SPACE, UI_OPACITY, UI_ICON_SIZE } from "../../constants/ui-tokens"
import { hapticLight } from "../../utils/haptics"
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

  /** Additional styles applied to the sheet panel (after default padding). */
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
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (open) {
      void hapticLight()
    }
  }, [open])

  if (!open && unmountWhenClosed) {
    return null
  }

  // Snap points are percentages of screen height; use the largest as the
  // panel height and let smaller content grow only up to that bound.
  const heightPercent = Math.max(...snapPoints, 50)

  return (
    <Modal transparent animationType="slide" visible={open} onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={dismissOnSnapToBottom ? onClose : undefined}
          accessible={false}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="max-h-full"
        >
          <View
            style={[
              {
                height: `${heightPercent}%`,
                padding: UI_SPACE.gutter,
                paddingBottom: Math.max(insets.bottom, UI_SPACE.gutter),
              },
              frameStyle,
            ]}
            className="rounded-t-card bg-surface"
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>

            <View className="flex-1 gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">{title}</Text>
                  {subtitle ? (
                    <Text
                      className="text-[13px] text-muted-foreground"
                      style={{ opacity: UI_OPACITY.medium }}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                <IconActionButton
                  icon={<X size={UI_ICON_SIZE.medium} />}
                  onPress={onClose}
                  tooltip={t("common.close")}
                  accessibilityLabel={t("common.close")}
                />
              </View>

              {scroll ? (
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {children}
                </ScrollView>
              ) : (
                children
              )}

              {footer ? <View className="gap-2">{footer}</View> : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

export type { AppSheetScaffoldProps }
