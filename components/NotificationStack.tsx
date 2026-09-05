import React from "react"
import { Text, View as RNView, ViewStyle, TextStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react-native"
import { useNotifications } from "../stores/hooks"
import { NotificationType } from "../stores/notification-store"
import {
  getNotificationColor,
  NOTIFICATION_STYLE_TOKENS,
} from "../constants/theme-colors"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_Z_INDEX,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
  UI_FONT_SIZE,
} from "../constants/ui-tokens"

const NotificationIcon = React.memo(function NotificationIcon({
  type,
}: {
  type: NotificationType
}) {
  const styles = NOTIFICATION_STYLE_TOKENS[type]
  const iconColor = styles.textColor as `#${string}`
  const iconProps = { size: UI_ICON_SIZE.regular, color: iconColor }

  const iconContainerStyle: ViewStyle = {
    backgroundColor: styles.iconBg,
    borderRadius: UI_RADIUS.surface,
    padding: UI_SPACE.micro + 2,
  }

  const icon = (() => {
    switch (type) {
      case "success":
        return <CheckCircle {...iconProps} />
      case "error":
        return <XCircle {...iconProps} />
      case "warning":
        return <AlertTriangle {...iconProps} />
      case "info":
      default:
        return <Info {...iconProps} />
    }
  })()

  return <RNView style={iconContainerStyle}>{icon}</RNView>
})

const notificationTextStyle: TextStyle = {
  fontSize: UI_FONT_SIZE.caption,
  fontWeight: UI_FONT_WEIGHT.medium as TextStyle["fontWeight"],
  flex: 1,
}

export const NotificationStack: React.FC = () => {
  const { notifications } = useNotifications()
  const insets = useSafeAreaInsets()

  if (notifications.length === 0) return null

  const containerStyle: ViewStyle = {
    position: "absolute",
    top: insets.top + UI_SPACE.gutter,
    left: 0,
    right: 0,
    zIndex: UI_Z_INDEX.toast,
    gap: UI_SPACE.section - 2,
    paddingHorizontal: UI_SPACE.gutter,
  }

  return (
    <RNView style={containerStyle} pointerEvents="box-none">
      {notifications.map((notification) => {
        const bgColor = getNotificationColor(notification.type)
        const styles = NOTIFICATION_STYLE_TOKENS[notification.type]

        const notificationStyle: ViewStyle = {
          flexDirection: "row",
          alignItems: "center",
          gap: UI_SPACE.section - 2,
          paddingVertical: UI_SPACE.section - 2,
          paddingHorizontal: UI_SPACE.gutter,
          borderRadius: UI_RADIUS.surface,
          backgroundColor: bgColor,
          borderWidth: UI_BORDER_WIDTH.normal,
          borderColor: styles.borderColor,
          // Notification-only soft colored shadow; not the neutral card elevation.
          shadowColor: bgColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }

        return (
          <RNView
            key={notification.id}
            style={notificationStyle}
            accessibilityRole="alert"
          >
            <NotificationIcon key={`icon-${notification.id}`} type={notification.type} />
            <Text
              key={`text-${notification.id}`}
              style={[notificationTextStyle, { color: styles.textColor }]}
            >
              {notification.message}
            </Text>
          </RNView>
        )
      })}
    </RNView>
  )
}
