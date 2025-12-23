import React, { useEffect, useRef } from "react"
import { useTheme } from "tamagui"
import { Cloud, CheckCircle, XCircle } from "@tamagui/lucide-icons"
import { Animated, Easing, View, StyleSheet } from "react-native"
import { useSyncStatus } from "../context/sync-status-context"
import { getColorValue } from "../tamagui.config"

// Using StyleSheet for positioning that Tamagui's type system doesn't support
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10000,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
})

export const SyncIndicator: React.FC = () => {
  const { syncStatus } = useSyncStatus()
  const theme = useTheme()
  const spinValue = useRef(new Animated.Value(0)).current
  const scaleValue = useRef(new Animated.Value(1)).current

  // Theme colors
  const blue10Color = getColorValue(theme.blue10)

  // Spinning animation for syncing state
  useEffect(() => {
    if (syncStatus === "syncing") {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start()
    } else {
      spinValue.setValue(0)
    }
  }, [syncStatus, spinValue])

  // Scale animation for success
  useEffect(() => {
    if (syncStatus === "success") {
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [syncStatus, scaleValue])

  if (syncStatus === "idle") return null

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  const getIcon = () => {
    switch (syncStatus) {
      case "syncing":
        return <Cloud size={24} color={blue10Color} />
      case "success":
        return <CheckCircle size={24} color="#22c55e" />
      case "error":
        return <XCircle size={24} color="#ef4444" />
      default:
        return null
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [
            { rotate: syncStatus === "syncing" ? spin : "0deg" },
            { scale: scaleValue },
          ],
        }}
      >
        {getIcon()}
      </Animated.View>
    </View>
  )
}
