import React, { useState, useEffect } from "react"
import { CheckCircle, XCircle } from "@tamagui/lucide-icons"
import { View, StyleSheet, useColorScheme, ActivityIndicator } from "react-native"
import { useSyncStatus } from "../hooks/use-sync"
import {
  SEMANTIC_COLORS,
  getOverlayColors,
  ACCENT_COLORS,
} from "../constants/theme-colors"

export const SyncIndicator: React.FC = () => {
  const { syncStatus } = useSyncStatus()
  const colorScheme = useColorScheme() ?? "light"
  const overlayColors = getOverlayColors(colorScheme)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (syncStatus === "syncing") {
      setVisible(true)
    } else if (syncStatus === "success") {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(timer)
    } else if (syncStatus === "error") {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [syncStatus])

  const styles = StyleSheet.create({
    container: {
      position: "absolute",
      top: 50,
      right: 20,
      zIndex: 10000,
      backgroundColor: overlayColors.background,
      borderRadius: 20,
      padding: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
  })

  if (!visible) return null

  const getIcon = () => {
    switch (syncStatus) {
      case "syncing":
        return <ActivityIndicator size="small" color={ACCENT_COLORS.primary} />
      case "success":
        return <CheckCircle size={24} color={SEMANTIC_COLORS.success} />
      case "error":
        return <XCircle size={24} color={SEMANTIC_COLORS.error} />
      default:
        return null
    }
  }

  return <View style={styles.container}>{getIcon()}</View>
}
