import React, { useEffect, useRef, useState } from "react"
import { CheckCircle, XCircle } from "@tamagui/lucide-icons-2"
import { View, StyleSheet, useColorScheme, ActivityIndicator } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useSyncEngine } from "../hooks/use-sync-engine"
import {
  SEMANTIC_COLORS,
  getOverlayColors,
  ACCENT_COLORS,
} from "../constants/theme-colors"
import { UI_RADIUS, UI_SPACE, UI_Z_INDEX, UI_ICON_SIZE } from "../constants/ui-tokens"

/**
 * Global sync status indicator.
 *
 * Driven by the SyncOrchestrator state:
 * - running / syncing / reconciling: show spinner
 * - just completed successfully (or in-sync): show checkmark for ~2s
 * - just failed: show X for ~2s
 * - otherwise hidden
 */
export const SyncIndicator: React.FC = () => {
  const { isSyncing, lastOutcome, runVersion } = useSyncEngine()
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme() ?? "light"
  const overlayColors = getOverlayColors(colorScheme)

  // Briefly surface the outcome of the most recently completed run. `runVersion`
  // bumps once per completed run so we re-trigger even on repeated outcomes.
  const [recentOutcome, setRecentOutcome] = useState<"success" | "error" | null>(null)
  const lastVersionRef = useRef(runVersion)

  // Derive outcome from runVersion/lastOutcome during render (avoids
  // synchronous setState inside an effect, satisfying the lint rule).
  if (runVersion !== lastVersionRef.current) {
    lastVersionRef.current = runVersion
    if (lastOutcome === "success" || lastOutcome === "in_sync") {
      setRecentOutcome("success")
    } else if (lastOutcome === "error") {
      setRecentOutcome("error")
    } else {
      setRecentOutcome(null)
    }
  }

  useEffect(() => {
    if (!recentOutcome) return
    const timer = setTimeout(() => setRecentOutcome(null), 2000)
    return () => clearTimeout(timer)
  }, [recentOutcome])

  const isSuccess = !isSyncing && recentOutcome === "success"
  const isError = !isSyncing && recentOutcome === "error"
  const visible = isSyncing || isSuccess || isError

  if (!visible) return null

  const styles = StyleSheet.create({
    container: {
      position: "absolute",
      top: insets.top + UI_SPACE.gutter,
      right: UI_SPACE.block,
      zIndex: UI_Z_INDEX.floating,
      backgroundColor: overlayColors.background,
      borderRadius: UI_RADIUS.surface,
      padding: UI_SPACE.control,
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
      return <CheckCircle size={UI_ICON_SIZE.large} color={SEMANTIC_COLORS.success} />
    }
    if (isError) {
      return <XCircle size={UI_ICON_SIZE.large} color={SEMANTIC_COLORS.error} />
    }
    return null
  }

  return <View style={styles.container}>{getIcon()}</View>
}
