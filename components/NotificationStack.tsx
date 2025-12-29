import React from "react"
import { Card, Text, styled } from "tamagui"
import { CheckCircle, XCircle, Info, AlertTriangle } from "@tamagui/lucide-icons"
import { useNotifications, NotificationType } from "../context/notification-context"
import { View, StyleSheet } from "react-native"
import { getNotificationColor } from "../constants/theme-colors"

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
  const iconProps = { size: 20, color: "#ffffff" as `#${string}` }

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
}

// Using StyleSheet for positioning that Tamagui's type system doesn't support
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 9999,
    gap: 8,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
})

const NotificationText = styled(Text, {
  name: "NotificationText",
  color: "white",
  fontSize: 14,
  fontWeight: "500",
  flex: 1,
})

export const NotificationStack: React.FC = () => {
  const { notifications } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <View style={styles.container} pointerEvents="box-none">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          animation="quick"
          enterStyle={{ opacity: 0, y: -20 }}
          exitStyle={{ opacity: 0, y: -20 }}
          style={[
            styles.card,
            { backgroundColor: getNotificationColor(notification.type) },
          ]}
        >
          <NotificationIcon type={notification.type} />
          <NotificationText>{notification.message}</NotificationText>
        </Card>
      ))}
    </View>
  )
}
