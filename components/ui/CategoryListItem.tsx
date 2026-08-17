import { memo, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { View, Text } from "react-native"
import { Pressable, Alert } from "react-native"
import { Pencil, Trash2 } from "lucide-react-native"
import { IconActionButton } from "./IconActionButton"
import { Category } from "../../types/category"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { resolveCategoryColor } from "../../utils/resolve-category-color"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

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
  const theme = useThemeColors()
  // Resolve color for display
  const { resolvedColor, iconColor } = resolveCategoryColor(category.color)

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
    if (len <= 8) return 14
    if (len <= 12) return 13
    return 12
  }, [category.label.length])

  return (
    <Pressable onPress={handleEdit}>
      <View
        className="flex-row items-center gap-2 rounded-control bg-surface p-2"
        style={{ minHeight: UI_ICON_SIZE.huge }}
      >
        {/* Icon with color background */}
        <View
          className="items-center justify-center rounded-chip"
          style={{
            width: UI_ICON_SIZE.xxlarge,
            height: UI_ICON_SIZE.xxlarge,
            backgroundColor: resolvedColor,
          }}
        >
          <DynamicCategoryIcon
            name={category.icon}
            size={UI_ICON_SIZE.medium}
            color={iconColor}
          />
        </View>

        {/* Label and color indicator */}
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1">
            <Text
              className="text-foreground"
              style={{ fontWeight: UI_FONT_WEIGHT.medium, fontSize: labelFontSize }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {category.label === "Other"
                ? t("settings.categories.other")
                : category.label}
            </Text>
            {category.isDefault && (
              <Text
                className="text-[11px] text-foreground"
                style={{ opacity: UI_OPACITY.faint }}
              >
                (default)
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-1">
            <View
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                borderRadius: UI_SPACE.micro - 1,
                backgroundColor: resolvedColor,
              }}
            />
            <Text
              className="text-[11px] text-foreground"
              style={{ opacity: UI_OPACITY.subtle }}
              numberOfLines={1}
            >
              {category.color}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row items-center gap-1">
          <IconActionButton
            icon={<Pencil size={UI_ICON_SIZE.small} color={theme.foreground} />}
            onPress={handleEdit}
            tooltip={t("common.editLabel", { label: category.label })}
            accessibilityLabel={t("common.editLabel", { label: category.label })}
          />
          {canDelete && (
            <IconActionButton
              icon={<Trash2 size={UI_ICON_SIZE.small} color={theme.foreground} />}
              onPress={handleDelete}
              tooltip={t("common.deleteLabel", { label: category.label })}
              accessibilityLabel={t("common.deleteLabel", { label: category.label })}
            />
          )}
        </View>
      </View>
    </Pressable>
  )
})

export type { CategoryListItemProps }
