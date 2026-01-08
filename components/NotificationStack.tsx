import React from "react"
import { View as RNView, ViewStyle } from "react-native"
import { Text, YStack, styled } from "tamagui"
import { CheckCircle, XCircle, Info, AlertTriangle } from "@tamagui/lucide-icons"
import { useNotifications } from "../stores/hooks"
import { NotificationType } from "../stores/notification-store"
import { getNotificationColor } from "../constants/theme-colors"

// Kawaii notification styling with softer colors and rounded design
const NOTIFICATION_STYLES: Record<
  NotificationType,
  { iconBg: string; textColor: string; borderColor: string }
> = {
  success: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: "#1A5A3A", // Dark green for contrast
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  error: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: "#8B2A2A", // Dark red for contrast
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  warning: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: "#6B4A1A", // Dark orange for contrast
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  info: {
    iconBg: "rgba(255, 255, 255, 0.3)",
    textColor: "#1A4A6B", // Dark blue for contrast
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
}

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
  const styles = NOTIFICATION_STYLES[type]
  const iconColor = styles.textColor as `#${string}`
  const iconProps = { size: 18, color: iconColor }

  const iconContainerStyle: ViewStyle = {
    backgroundColor: styles.iconBg,
    borderRadius: 20,
    padding: 6,
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
}

const NotificationText = styled(Text, {
  name: "NotificationText",
  fontSize: 13,
  fontWeight: "500",
  flex: 1,
  lineHeight: 18,
})

const containerStyle: ViewStyle = {
  position: "absolute",
  top: 50,
  left: 0,
  right: 0,
  zIndex: 9999,
  gap: 10,
  paddingHorizontal: 16,
}

export const NotificationStack: React.FC = () => {
  const { notifications } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <YStack style={containerStyle} pointerEvents="box-none">
      {notifications.map((notification) => {
        const bgColor = getNotificationColor(notification.type)
        const styles = NOTIFICATION_STYLES[notification.type]

        const notificationStyle: ViewStyle = {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: bgColor,
          borderWidth: 2,
          borderColor: styles.borderColor,
          // Soft shadow for kawaii feel
          shadowColor: bgColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }

        return (
          <RNView key={notification.id} style={notificationStyle}>
            <NotificationIcon type={notification.type} />
            <NotificationText style={{ color: styles.textColor }}>
              {notification.message}
            </NotificationText>
          </RNView>
        )
      })}
    </YStack>
  )
}
