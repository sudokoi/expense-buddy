import { memo, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { YStack, XStack, Text, Button } from "tamagui"
import { ViewStyle, Pressable, Alert } from "react-native"
import { Pencil, Trash2 } from "@tamagui/lucide-icons-2"
import { Category } from "../../types/category"
import { getColorValue } from "../../tamagui.config"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { getReadableTextColor } from "../../constants/theme-colors"
import { UI_RADIUS, UI_SPACE, UI_OPACITY, UI_FONT_WEIGHT, UI_ICON_SIZE } from "../../constants/ui-tokens"

// Layout styles
const layoutStyles = {
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: UI_SPACE.control,
    borderRadius: UI_RADIUS.control,
    gap: UI_SPACE.control,
    minHeight: UI_ICON_SIZE.huge,
  } as ViewStyle,
  iconContainer: {
    width: UI_ICON_SIZE.xxlarge,
    height: UI_ICON_SIZE.xxlarge,
    borderRadius: UI_RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as ViewStyle,
  labelContainer: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: UI_SPACE.micro / 2,
    flexShrink: 0,
  } as ViewStyle,
  colorIndicator: {
    width: 6,
    height: 6,
    borderRadius: UI_SPACE.micro - 1,
    flexShrink: 0,
  } as ViewStyle,
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: UI_SPACE.micro,
  } as ViewStyle,
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: UI_SPACE.micro,
  } as ViewStyle,
}

interface CategoryListItemProps {
  /** The category to display */
  category: Category
  /** Callback when edit is pressed */
  onEdit: (category: Category) => void
  /** Callback when delete is confirmed */
  onDelete: (label: string) => void
  /** Number of expenses using this category (for delete confirmation) */
  expenseCount?: number
  /** Whether this category can be deleted (false for "Other") */
  canDelete?: boolean
}

/**
 * CategoryListItem - Displays a category in the settings list
 * Shows icon, label, color indicator, and edit/delete actions
 */
export const CategoryListItem = memo(function CategoryListItem({
  category,
  onEdit,
  onDelete,
  expenseCount = 0,
  canDelete = true,
}: CategoryListItemProps) {
  const { t } = useTranslation()
  // Resolve color for display
  const resolvedColor = useMemo(() => getColorValue(category.color), [category.color])
  const iconColor = useMemo(() => getReadableTextColor(resolvedColor), [resolvedColor])

  // Handle edit press
  const handleEdit = useCallback(() => {
    onEdit(category)
  }, [category, onEdit])

  // Handle delete with confirmation
  const handleDelete = useCallback(() => {
    const message =
      expenseCount > 0
        ? t("settings.categories.deleteDialog.messageReassign", {
            label: category.label,
            count: expenseCount,
          })
        : t("settings.categories.deleteDialog.messageSimple", {
            label: category.label,
          })

    Alert.alert(t("settings.categories.deleteDialog.title"), message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => onDelete(category.label),
      },
    ])
  }, [category.label, expenseCount, onDelete, t])

  // Calculate font size based on label length to fit text
  const labelFontSize = useMemo(() => {
    const len = category.label.length
    if (len <= 8) return "$label"
    if (len <= 12) return "$body"
    return "$caption"
  }, [category.label.length])

  return (
    <Pressable onPress={handleEdit}>
      <XStack style={layoutStyles.container} bg="$backgroundHover">
        {/* Icon with color background */}
        <YStack style={[layoutStyles.iconContainer, { backgroundColor: resolvedColor }]}>
          <DynamicCategoryIcon name={category.icon} size={UI_ICON_SIZE.medium} color={iconColor} />
        </YStack>

        {/* Label and color indicator */}
        <YStack style={layoutStyles.labelContainer}>
          <XStack style={layoutStyles.labelRow}>
            <Text
              fontWeight={UI_FONT_WEIGHT.medium}
              fontSize={labelFontSize}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ flexShrink: 1 }}
            >
              {category.label === "Other"
                ? t("settings.categories.other")
                : category.label}
            </Text>
            {category.isDefault && (
              <Text
                fontSize="$micro"
                color="$color"
                opacity={UI_OPACITY.faint}
                style={{ flexShrink: 0 }}
              >
                (default)
              </Text>
            )}
          </XStack>
          <XStack style={layoutStyles.colorRow}>
            <YStack
              style={[layoutStyles.colorIndicator, { backgroundColor: resolvedColor }]}
            />
            <Text fontSize="$micro" color="$color" opacity={UI_OPACITY.subtle} numberOfLines={1}>
              {category.color}
            </Text>
          </XStack>
        </YStack>

        {/* Action buttons */}
        <XStack style={layoutStyles.actionsContainer}>
          <Button
            size="$chip"
            chromeless
            icon={<Pencil size={UI_ICON_SIZE.small} />}
            onPress={handleEdit}
            aria-label={t("common.editLabel", { label: category.label })}
          />
          {canDelete && (
            <Button
              size="$chip"
              chromeless
              icon={<Trash2 size={UI_ICON_SIZE.small} />}
              onPress={handleDelete}
              aria-label={t("common.deleteLabel", { label: category.label })}
            />
          )}
        </XStack>
      </XStack>
    </Pressable>
  )
})

export type { CategoryListItemProps }
