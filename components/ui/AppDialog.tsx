import { useRef } from "react"
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useReducedMotion } from "react-native-reanimated"
import { Button } from "./Button"
import type { AppDialogAction } from "../../utils/app-dialog-queue"
import { UI_SPACE } from "../../constants/ui-tokens"
import { MODAL_BACKDROP_COLOR } from "../../constants/palette"

interface AppDialogProps {
  title: string
  message: string
  actions: AppDialogAction[]
  onAction: (index: number) => void
  onDismiss: () => void
}

/** Shared Delete Expense presentation for app-owned confirmations, not OS prompts. */
export function AppDialog({
  title,
  message,
  actions,
  onAction,
  onDismiss,
}: AppDialogProps) {
  const { height, width, fontScale } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const heading = useRef<Text>(null)
  // Dialog-specific fit thresholds: avoid crowded actions on narrow/large-text screens.
  const stacked = actions.length > 2 || fontScale > 1.2 || width < 360

  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onDismiss}
      onShow={() => {
        const node = findNodeHandle(heading.current)
        if (node) AccessibilityInfo.setAccessibilityFocus(node)
      }}
    >
      <View
        className="flex-1 items-center justify-center px-6"
        style={{
          backgroundColor: MODAL_BACKDROP_COLOR,
          paddingTop: insets.top + UI_SPACE.content,
          paddingBottom: insets.bottom + UI_SPACE.content,
        }}
      >
        <View
          className="w-full max-w-sm rounded-card border border-border bg-surface"
          style={{
            maxHeight: Math.max(
              0,
              height - insets.top - insets.bottom - UI_SPACE.content * 2
            ),
          }}
          accessibilityViewIsModal
          onAccessibilityEscape={onDismiss}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={{ padding: UI_SPACE.block, gap: UI_SPACE.content }}
          >
            <Text
              ref={heading}
              className="text-lg font-semibold text-foreground"
              accessibilityRole="header"
              accessible
            >
              {title}
            </Text>
            <Text className="text-sm text-muted-foreground">{message}</Text>
            <View className={stacked ? "gap-3" : "flex-row flex-wrap justify-end gap-3"}>
              {actions.map((action, index) => (
                <Button
                  key={index}
                  className="max-w-full"
                  size="control"
                  variant={
                    action.style === "destructive"
                      ? "destructive"
                      : action.style === "cancel"
                        ? "outline"
                        : actions.filter((item) => item.style !== "cancel").length === 1
                          ? "accent"
                          : "outline"
                  }
                  onPress={() => onAction(index)}
                  accessibilityLabel={action.text}
                >
                  {action.text}
                </Button>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
