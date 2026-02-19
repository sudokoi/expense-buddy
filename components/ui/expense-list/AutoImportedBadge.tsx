import { memo } from "react"
import { XStack, Text } from "tamagui"
import { useTranslation } from "react-i18next"

interface AutoImportedBadgeProps {
  source?: string
}

/**
 * Small inline badge that indicates an expense was auto-imported from SMS.
 * Renders only when source is 'auto-imported', returns null otherwise.
 */
export const AutoImportedBadge = memo(function AutoImportedBadge({
  source,
}: AutoImportedBadgeProps) {
  const { t } = useTranslation()

  if (source !== "auto-imported") return null

  return (
    <XStack bg="$backgroundFocus" px="$2" py="$1" rounded="$2" items="center" gap="$1">
      <Text fontSize={10} color="$color" opacity={0.7}>
        {t("smsImport.autoImportedBadge")}
      </Text>
    </XStack>
  )
})
