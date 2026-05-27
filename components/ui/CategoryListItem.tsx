import { memo, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { YStack, XStack, Text, Button } from "tamagui"
import { Pressable, Alert } from "react-native"
import { Pencil, Trash2 } from "@tamagui/lucide-icons-2"
import { Category } from "../../types/category"
import { getColorValue } from "../../tamagui.config"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { getReadableTextColor } from "../../constants/theme-colors"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"



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
      <XStack flexDirection="row" items="center" p={UI_SPACE.control} rounded={UI_RADIUS.control} gap={UI_SPACE.control} minH={UI_ICON_SIZE.huge} bg="$backgroundHover">
        {/* Icon with color background */}
        <YStack width={UI_ICON_SIZE.xxlarge} height={UI_ICON_SIZE.xxlarge} rounded={UI_RADIUS.chip} items="center" justify="center" shrink={0} style={{ backgroundColor: resolvedColor }}>
          <DynamicCategoryIcon
            name={category.icon}
            size={UI_ICON_SIZE.medium}
            color={iconColor}
          />
        </YStack>

        {/* Label and color indicator */}
        <YStack flex={1} minW={0}>
          <XStack flexDirection="row" items="center" gap={UI_SPACE.micro}>
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
          <XStack flexDirection="row" items="center" gap={UI_SPACE.micro}>
            <YStack
              width={6} height={6} rounded={UI_SPACE.micro - 1} shrink={0}
              style={{ backgroundColor: resolvedColor }}
            />
            <Text
              fontSize="$micro"
              color="$color"
              opacity={UI_OPACITY.subtle}
              numberOfLines={1}
            >
              {category.color}
            </Text>
          </XStack>
        </YStack>

        {/* Action buttons */}
        <XStack flexDirection="row" items="center" gap={UI_SPACE.micro / 2} shrink={0}>
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
