import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

function isSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android"
}

export function hapticSelection() {
  if (isSupported()) {
    void Haptics.selectionAsync()
  }
}

export function hapticLight() {
  if (isSupported()) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
}

export function hapticMedium() {
  if (isSupported()) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }
}

export function hapticSuccess() {
  if (isSupported()) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }
}

export function hapticWarning() {
  if (isSupported()) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }
}

export function hapticError() {
  if (isSupported()) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}
