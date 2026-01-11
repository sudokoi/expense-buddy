import { memo, useMemo, useCallback } from "react"
import { YStack, XStack, Text, Button } from "tamagui"
import { ViewStyle, Pressable, Alert } from "react-native"
import { Pencil, Trash2 } from "@tamagui/lucide-icons"
import { Category } from "../../types/category"
import { getColorValue } from "../../tamagui.config"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { getReadableTextColor } from "../../constants/theme-colors"

// Layout styles
const layoutStyles = {
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    gap: 8,
    minHeight: 56,
  } as ViewStyle,
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
    gap: 2,
    flexShrink: 0,
  } as ViewStyle,
  colorIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  } as ViewStyle,
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  } as ViewStyle,
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
        ? `This will reassign ${expenseCount} expense${expenseCount > 1 ? "s" : ""} to "Other". Are you sure?`
        : `Delete "${category.label}" category?`

    Alert.alert("Delete Category", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(category.label),
      },
    ])
  }, [category.label, expenseCount, onDelete])

  // Calculate font size based on label length to fit text
  const labelFontSize = useMemo(() => {
    const len = category.label.length
    if (len <= 8) return "$4"
    if (len <= 12) return "$3"
    return "$2"
  }, [category.label.length])

  return (
    <Pressable onPress={handleEdit}>
      <XStack style={layoutStyles.container} bg="$backgroundHover">
        {/* Icon with color background */}
        <YStack style={[layoutStyles.iconContainer, { backgroundColor: resolvedColor }]}>
          <DynamicCategoryIcon name={category.icon} size={20} color={iconColor} />
        </YStack>

        {/* Label and color indicator */}
        <YStack style={layoutStyles.labelContainer}>
          <XStack style={layoutStyles.labelRow}>
            <Text
              fontWeight="500"
              fontSize={labelFontSize}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ flexShrink: 1 }}
            >
              {category.label}
            </Text>
            {category.isDefault && (
              <Text fontSize="$1" color="$color" opacity={0.5} style={{ flexShrink: 0 }}>
                (default)
              </Text>
            )}
          </XStack>
          <XStack style={layoutStyles.colorRow}>
            <YStack
              style={[layoutStyles.colorIndicator, { backgroundColor: resolvedColor }]}
            />
            <Text fontSize="$1" color="$color" opacity={0.6} numberOfLines={1}>
              {category.color}
            </Text>
          </XStack>
        </YStack>

        {/* Action buttons */}
        <XStack style={layoutStyles.actionsContainer}>
          <Button
            size="$2"
            chromeless
            icon={<Pencil size={16} />}
            onPress={handleEdit}
            aria-label={`Edit ${category.label}`}
          />
          {canDelete && (
            <Button
              size="$2"
              chromeless
              icon={<Trash2 size={16} />}
              onPress={handleDelete}
              aria-label={`Delete ${category.label}`}
            />
          )}
        </XStack>
      </XStack>
    </Pressable>
  )
})

export type { CategoryListItemProps }
