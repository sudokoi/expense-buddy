import { useRef, useMemo, useCallback } from "react"
import { Animated, PanResponder } from "react-native"

interface UseSwipeRevealOptions {
  swipeThreshold?: number
  openRatio?: number
  direction?: "left" | "right"
  verticalThresholdMultiplier?: number
}

export function useSwipeReveal(options: UseSwipeRevealOptions = {}) {
  const {
    swipeThreshold = 60,
    openRatio = 0.85,
    direction = "left",
    verticalThresholdMultiplier = 1,
  } = options

  const translateX = useRef(new Animated.Value(0)).current
  const isOpenRef = useRef(false)
  const actionsWidthRef = useRef(0)

  const open = useCallback(() => {
    const w = actionsWidthRef.current
    const toValue = direction === "left" ? -(w * openRatio) : w * openRatio
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
    isOpenRef.current = true
  }, [translateX, openRatio, direction])

  const close = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
    isOpenRef.current = false
  }, [translateX])

  const snapTo = useCallback(
    (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start()
      isOpenRef.current = toValue !== 0
    },
    [translateX]
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 10 &&
          Math.abs(gs.dx) * verticalThresholdMultiplier > Math.abs(gs.dy),
        onPanResponderMove: (_, gs) => {
          const w = actionsWidthRef.current * openRatio
          const base = isOpenRef.current ? (direction === "left" ? -w : w) : 0
          const min = direction === "left" ? -w : 0
          const max = direction === "left" ? 0 : w
          const next = Math.max(Math.min(max, base + gs.dx), min)
          translateX.setValue(next)
        },
        onPanResponderRelease: (_, gs) => {
          const shouldOpen =
            direction === "left" ? gs.dx < -swipeThreshold : gs.dx > swipeThreshold
          if (shouldOpen && !isOpenRef.current) {
            open()
          } else {
            close()
          }
        },
        onPanResponderTerminate: () => {
          close()
        },
      }),
    [
      translateX,
      open,
      close,
      openRatio,
      swipeThreshold,
      direction,
      verticalThresholdMultiplier,
    ]
  )

  return {
    translateX,
    panResponder,
    open,
    close,
    snapTo,
    isOpenRef,
    actionsWidthRef,
  }
}
