/**
 * ReviewQueueFab
 *
 * Floating action button that shows pending review count and opens ReviewQueueModal.
 * Displays when there are pending items in the SMS import review queue.
 */

import { useState, useCallback, useMemo } from "react"
import { XStack, Text, Button, isWeb } from "tamagui"
import { Bell } from "@tamagui/lucide-icons"
import { useTranslation } from "react-i18next"
import { useSelector } from "@xstate/store/react"
import { reviewQueueStore } from "../../../stores/review-queue-store"
import { ReviewQueueModal } from "./ReviewQueueModal"
import { ACCENT_COLORS } from "../../../constants/theme-colors"
import { ViewStyle } from "react-native"

const layoutStyles = {
  fab: {
    position: "absolute" as const,
    bottom: 80,
    right: 16,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  } as ViewStyle,
}

export function ReviewQueueFab() {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)

  const pendingReview = useSelector(
    reviewQueueStore,
    (state) => state.context.stats.pendingReview
  )

  const queue = useSelector(reviewQueueStore, (state) => state.context.queue)

  const currentItem = useMemo(
    () => queue.find((item) => item.status === "pending") ?? null,
    [queue]
  )

  const handlePress = useCallback(() => {
    if (pendingReview > 0) {
      setModalOpen(true)
    }
  }, [pendingReview])

  const handleClose = useCallback(() => {
    setModalOpen(false)
  }, [])

  if (pendingReview === 0) {
    return null
  }

  return (
    <>
      <Button
        size="$4"
        themeInverse
        onPress={handlePress}
        style={[
          layoutStyles.fab,
          { backgroundColor: ACCENT_COLORS.primary },
          isWeb && { cursor: "pointer" },
        ]}
        aria-label={t("smsImport.reviewQueue.title")}
      >
        <XStack gap="$2" style={{ alignItems: "center" } as ViewStyle}>
          <Bell size={20} color="white" />
          <Text color="white" fontWeight="600" fontSize="$4">
            {pendingReview}
          </Text>
          <Text color="white" fontSize="$3" opacity={0.9}>
            {t("smsImport.reviewQueue.pending")}
          </Text>
        </XStack>
      </Button>

      <ReviewQueueModal
        item={currentItem}
        open={modalOpen}
        onClose={handleClose}
        pendingCount={pendingReview}
      />
    </>
  )
}
