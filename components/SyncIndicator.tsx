import React from "react"
import { CheckCircle, XCircle } from "lucide-react-native"
import { View, ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useSyncMachine } from "../hooks/use-sync-machine"
import {
  SEMANTIC_COLORS,
  getOverlayColors,
  ACCENT_COLORS,
} from "../constants/theme-colors"
import { useThemeScheme } from "../hooks/use-theme-colors"
import { UI_ICON_SIZE } from "../constants/ui-tokens"

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
  const insets = useSafeAreaInsets()
  const colorScheme = useThemeScheme()
  const overlayColors = getOverlayColors(colorScheme)

  // Derive visibility directly from machine state
  // Machine auto-resets from success after 2 seconds
  const visible = isSyncing || isSuccess || isError

  if (!visible) return null

  const getIcon = () => {
    if (isSyncing) {
      return <ActivityIndicator size="small" color={ACCENT_COLORS.primary} />
    }
    if (isSuccess) {
      return <CheckCircle size={UI_ICON_SIZE.large} color={SEMANTIC_COLORS.success} />
    }
    if (isError) {
      return <XCircle size={UI_ICON_SIZE.large} color={SEMANTIC_COLORS.error} />
    }
    return null
  }

  return (
    <View
      className="absolute right-6 z-[10000] rounded-surface p-2 shadow-sm"
      style={{
        top: insets.top + 20,
        backgroundColor: overlayColors.background,
        shadowColor: overlayColors.shadow,
      }}
    >
      {getIcon()}
    </View>
  )
}
