import React from "react"
import { CheckCircle, XCircle } from "@tamagui/lucide-icons"
import { View, StyleSheet, useColorScheme, ActivityIndicator } from "react-native"
import { useSyncMachine } from "../hooks/use-sync-machine"
import {
  SEMANTIC_COLORS,
  getOverlayColors,
  ACCENT_COLORS,
} from "../constants/theme-colors"

/**
 * Global sync status indicator
 *
 * Shows spinning indicator during sync, checkmark on success, X on error.
 * Visibility is derived directly from XState machine state:
 * - syncing: show spinner
 * - success: show checkmark (machine auto-resets after 2s)
 * - error: show X
 * - idle/inSync: hidden
 */
export const SyncIndicator: React.FC = () => {
  const { isSyncing, isSuccess, isError } = useSyncMachine()
  const colorScheme = useColorScheme() ?? "light"
  const overlayColors = getOverlayColors(colorScheme)

  // Derive visibility directly from machine state
  // Machine auto-resets from success after 2 seconds
  const visible = isSyncing || isSuccess || isError

  if (!visible) return null

  const styles = StyleSheet.create({
    container: {
      position: "absolute",
      top: 50,
      right: 20,
      zIndex: 10000,
      backgroundColor: overlayColors.background,
      borderRadius: 20,
      padding: 8,
      shadowColor: overlayColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
  })

  const getIcon = () => {
    if (isSyncing) {
      return <ActivityIndicator size="small" color={ACCENT_COLORS.primary} />
    }
    if (isSuccess) {
      return <CheckCircle size={24} color={SEMANTIC_COLORS.success} />
    }
    if (isError) {
      return <XCircle size={24} color={SEMANTIC_COLORS.error} />
    }
    return null
  }

  return <View style={styles.container}>{getIcon()}</View>
}
