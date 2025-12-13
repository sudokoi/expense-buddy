import React from 'react';
import { YStack, Card, Text, useTheme } from 'tamagui';
import { CheckCircle, XCircle, Info, AlertTriangle } from '@tamagui/lucide-icons';
import { useNotifications, NotificationType } from '../context/notification-context';

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
  const iconProps = { size: 20, color: 'white' };

  switch (type) {
    case 'success':
      return <CheckCircle {...iconProps} />;
    case 'error':
      return <XCircle {...iconProps} />;
    case 'warning':
      return <AlertTriangle {...iconProps} />;
    case 'info':
    default:
      return <Info {...iconProps} />;
  }
};

const getNotificationColor = (type: NotificationType): string => {
  switch (type) {
    case 'success':
      return '#22c55e'; // Green
    case 'error':
      return '#ef4444'; // Red
    case 'warning':
      return '#f59e0b'; // Orange
    case 'info':
    default:
      return '#3b82f6'; // Blue
  }
};

export const NotificationStack: React.FC = () => {
  const { notifications } = useNotifications();
  const theme = useTheme();

  if (notifications.length === 0) return null;

  return (
    <YStack
      position="absolute"
      top={60}
      left={0}
      right={0}
      gap="$2"
      paddingHorizontal="$4"
      zIndex={9999}
      pointerEvents="box-none"
    >
      {notifications.map((notification, index) => (
        <Card
          key={notification.id}
          bordered
          animation="quick"
          enterStyle={{ opacity: 0, y: -20 }}
          exitStyle={{ opacity: 0, y: -20 }}
          style={{
            backgroundColor: getNotificationColor(notification.type),
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <NotificationIcon type={notification.type} />
          <Text
            style={{
              color: 'white',
              fontSize: 14,
              fontWeight: '500',
              flex: 1,
            }}
          >
            {notification.message}
          </Text>
        </Card>
      ))}
    </YStack>
  );
};
