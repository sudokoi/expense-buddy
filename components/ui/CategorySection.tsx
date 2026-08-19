import { useCallback, useMemo, memo, useState } from "react"
import { View, Text, Pressable } from "react-native"

import { Plus, ChevronDown, ChevronUp } from "lucide-react-native"
import { Category } from "../../types/category"
import { CategoryListItem } from "./CategoryListItem"
import { Button } from "./Button"
import { useTranslation } from "react-i18next"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_BORDER_WIDTH,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
import { useThemeColors } from "../../hooks/use-theme-colors"

interface CategorySectionProps {
  /** List of categories to display */
  categories: Category[]
  /** Callback when add button is pressed */
  onAdd: () => void
  /** Callback when a category is edited */
  onEdit: (category: Category) => void
  /** Callback when a category is deleted */
  onDelete: (label: string) => void
  /** Callback when categories are reordered */
  onReorder: (labels: string[]) => void
  /** Function to get expense count for a category */
  getExpenseCount?: (label: string) => number
}

/**
 * CategorySection - Collapsible settings section for managing categories
 * Displays category list with up/down buttons for reordering
 * "Other" category is always at the bottom and not reorderable
 */
export const CategorySection = memo(function CategorySection({
  categories,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  getExpenseCount,
}: CategorySectionProps) {
  const { t } = useTranslation()
  const theme = useThemeColors()
  const [expanded, setExpanded] = useState(false)

  // Separate "Other" category from reorderable categories
  // Categories are already sorted by order in useCategories hook
  const { reorderableCategories, otherCategory } = useMemo(() => {
    const other = categories.find((c) => c.label === "Other")
    const reorderable = categories.filter((c) => c.label !== "Other")
    return { reorderableCategories: reorderable, otherCategory: other }
  }, [categories])

  // Handle move up
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return
      const labels = reorderableCategories.map((c) => c.label)
      const temp = labels[index]
      labels[index] = labels[index - 1]
      labels[index - 1] = temp
      if (otherCategory) {
        labels.push("Other")
      }
      onReorder(labels)
    },
    [reorderableCategories, otherCategory, onReorder]
  )

  // Handle move down
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= reorderableCategories.length - 1) return
      const labels = reorderableCategories.map((c) => c.label)
      const temp = labels[index]
      labels[index] = labels[index + 1]
      labels[index + 1] = temp
      if (otherCategory) {
        labels.push("Other")
      }
      onReorder(labels)
    },
    [reorderableCategories, otherCategory, onReorder]
  )

  return (
    <View className="gap-3">
      <Text
        className="text-sm font-semibold text-foreground"
        style={{ fontWeight: UI_FONT_WEIGHT.semiBold }}
      >
        {t("settings.sections.categories")}
      </Text>
      <Text
        className="text-[13px] text-foreground"
        style={{ opacity: UI_OPACITY.medium }}
      >
        {t("settings.categories.description")}
      </Text>

      <View>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          className="flex-row items-center justify-between rounded-control bg-surface p-3"
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Text
              className="text-foreground"
              style={{ fontWeight: UI_FONT_WEIGHT.medium }}
            >
              {t("settings.categories.manage")}
            </Text>
            <Text
              className="text-xs text-foreground"
              style={{ opacity: UI_OPACITY.subtle }}
            >
              ({categories.length})
            </Text>
          </View>
          {expanded ? (
            <ChevronUp
              size={UI_ICON_SIZE.medium}
              color={theme.foreground}
              style={{ opacity: UI_OPACITY.subtle }}
            />
          ) : (
            <ChevronDown
              size={UI_ICON_SIZE.medium}
              color={theme.foreground}
              style={{ opacity: UI_OPACITY.subtle }}
            />
          )}
        </Pressable>

        {expanded && (
          <View className="gap-2 px-2 pt-3">
            <View className="gap-2">
              {reorderableCategories.map((category, index) => (
                <View key={category.label} className="flex-row items-center gap-1">
                  <View className="w-6 items-center justify-center">
                    <Pressable
                      onPress={() => handleMoveUp(index)}
                      disabled={index === 0}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.categories.moveUp", {
                        category: category.label,
                      })}
                      accessibilityState={{ disabled: index === 0 }}
                      style={{
                        opacity: index === 0 ? UI_OPACITY.minimal : UI_OPACITY.medium,
                      }}
                    >
                      <ChevronUp size={UI_ICON_SIZE.small} color={theme.foreground} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMoveDown(index)}
                      disabled={index === reorderableCategories.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings.categories.moveDown", {
                        category: category.label,
                      })}
                      accessibilityState={{
                        disabled: index === reorderableCategories.length - 1,
                      }}
                      style={{
                        opacity:
                          index === reorderableCategories.length - 1
                            ? UI_OPACITY.minimal
                            : UI_OPACITY.medium,
                      }}
                    >
                      <ChevronDown size={UI_ICON_SIZE.small} color={theme.foreground} />
                    </Pressable>
                  </View>

                  <View className="flex-1">
                    <CategoryListItem
                      category={category}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      expenseCount={getExpenseCount?.(category.label) ?? 0}
                      canDelete={true}
                    />
                  </View>
                </View>
              ))}
            </View>

            {otherCategory && (
              <View
                className="mt-2 border-t border-border pt-2"
                style={{ borderTopWidth: UI_BORDER_WIDTH.thin }}
              >
                <View className="flex-row items-center gap-1">
                  <View
                    className="w-6 items-center justify-center"
                    style={{ opacity: UI_OPACITY.minimal }}
                  >
                    <ChevronUp size={UI_ICON_SIZE.small} color={theme.foreground} />
                    <ChevronDown size={UI_ICON_SIZE.small} color={theme.foreground} />
                  </View>

                  <View className="flex-1">
                    <CategoryListItem
                      category={otherCategory}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      expenseCount={getExpenseCount?.(otherCategory.label) ?? 0}
                      canDelete={false}
                    />
                  </View>
                </View>
                <Text
                  className="text-[11px] text-foreground"
                  style={{
                    opacity: UI_OPACITY.ghost,
                    paddingLeft: UI_SPACE.block + UI_SPACE.micro,
                  }}
                >
                  {t("settings.categories.otherHelp")}
                </Text>
              </View>
            )}

            <View className="mt-4">
              <Button size="control" variant="accent" className="gap-2" onPress={onAdd}>
                <Plus size={UI_ICON_SIZE.regular} color={theme.accentForeground} />
                {t("settings.categories.add")}
              </Button>
            </View>
          </View>
        )}
      </View>
    </View>
  )
})

export type { CategorySectionProps }
