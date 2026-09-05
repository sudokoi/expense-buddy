import { memo } from "react"
import { Pressable, Text, View } from "react-native"
import { Trash2 } from "lucide-react-native"
import { useTranslation } from "react-i18next"
import type { Category } from "../../types/category"
import { resolveCategoryColor } from "../../utils/resolve-category-color"
import { DynamicCategoryIcon } from "./DynamicCategoryIcon"
import { IconActionButton } from "./IconActionButton"

interface CategoryListItemProps {
  category: Category
  onEdit: (category: Category) => void
  /** Caller owns confirmation and expense reassignment. */
  onDelete: (label: string) => void
  expenseCount?: number
  canDelete?: boolean
}

export const CategoryListItem = memo(function CategoryListItem({
  category,
  onEdit,
  onDelete,
  expenseCount = 0,
  canDelete = true,
}: CategoryListItemProps) {
  const { t } = useTranslation()
  const label =
    category.label === "Other" ? t("settings.categories.other") : category.label
  const { resolvedColor, iconColor } = resolveCategoryColor(category.color)
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        className="min-h-12 flex-1 flex-row items-center gap-3 py-2 active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel={t("common.editLabel", { label })}
        onPress={() => onEdit(category)}
      >
        <View
          className="h-8 w-8 items-center justify-center rounded-control"
          style={{ backgroundColor: resolvedColor }}
        >
          <DynamicCategoryIcon name={category.icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-base font-medium text-foreground">{label}</Text>
          <Text className="text-xs text-muted-foreground">
            {t("settings.categories.usage", { count: expenseCount })}
          </Text>
        </View>
      </Pressable>
      {canDelete ? (
        <IconActionButton
          icon={<Trash2 size={18} />}
          onPress={() => onDelete(category.label)}
          accessibilityLabel={t("common.deleteLabel", { label })}
          tooltip={t("common.deleteLabel", { label })}
        />
      ) : null}
    </View>
  )
})

export type { CategoryListItemProps }
