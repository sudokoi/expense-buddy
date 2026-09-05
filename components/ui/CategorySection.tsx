import { memo, useState } from "react"
import { UI_ICON_SIZE } from "../../constants/ui-tokens"
import { Pressable, Text, View } from "react-native"
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus } from "lucide-react-native"
import type { Category } from "../../types/category"
import { CategoryListItem } from "./CategoryListItem"
import { Button } from "./Button"
import { Input } from "./Input"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { moveCategory } from "../../utils/category-order"

interface CategorySectionProps {
  categories: Category[]
  onAdd: () => void
  onEdit: (category: Category) => void
  onDelete: (label: string) => void
  onReorder: (labels: string[]) => void
  getExpenseCount?: (label: string) => number
}

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
  const [query, setQuery] = useState("")
  const [reordering, setReordering] = useState(false)
  const categoryLabel = (category: Category) =>
    category.label === "Other" ? t("settings.categories.other") : category.label
  const visible = categories.filter((category) =>
    categoryLabel(category).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  )
  const movable = categories.filter((category) => category.label !== "Other")

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          className="min-h-12 flex-1 flex-row items-center gap-2 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={`${t("settings.categories.manage")}, ${categories.length}`}
          accessibilityState={{ expanded }}
          onPress={() => {
            setExpanded(!expanded)
            setReordering(false)
          }}
        >
          <Text className="flex-1 text-base font-semibold text-foreground">
            {t("settings.payment.categoriesTitle")} ({categories.length})
          </Text>
          {expanded ? (
            <ChevronUp size={UI_ICON_SIZE.medium} color={theme.mutedForeground} />
          ) : (
            <ChevronDown size={UI_ICON_SIZE.medium} color={theme.mutedForeground} />
          )}
        </Pressable>
        <Button
          icon={<Plus size={UI_ICON_SIZE.small} />}
          onPress={onAdd}
          accessibilityLabel={t("settings.categories.add")}
        >
          {t("instruments.add")}
        </Button>
      </View>
      {expanded ? (
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Input
              className="flex-1"
              value={query}
              onChangeText={(text) => {
                setQuery(text)
                setReordering(false)
              }}
              placeholder={t("settings.categories.search")}
              accessibilityLabel={t("settings.categories.search")}
              autoCorrect={false}
            />
            <Button
              disabled={!!query.trim() || movable.length < 2}
              onPress={() => setReordering(!reordering)}
              accessibilityState={{ selected: reordering }}
            >
              {reordering ? t("common.done") : t("settings.categories.reorder")}
            </Button>
          </View>
          {query.trim() ? (
            <Button onPress={() => setQuery("")}>{t("common.clearSearch")}</Button>
          ) : null}
          {visible.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              {t("settings.categories.noMatches")}
            </Text>
          ) : null}
          {visible.map((category) => (
            <View key={category.label} className="border-b border-border py-1">
              {reordering ? (
                <View className="min-h-12 flex-row items-center gap-2">
                  <Text className="flex-1 text-base text-foreground">
                    {categoryLabel(category)}
                  </Text>
                  {category.label !== "Other" ? (
                    <>
                      <Button
                        size="icon"
                        disabled={movable[0]?.label === category.label}
                        accessibilityLabel={t("settings.categories.moveUp", {
                          category: category.label,
                        })}
                        onPress={() =>
                          onReorder(
                            moveCategory(
                              categories.map((item) => item.label),
                              category.label,
                              -1
                            )
                          )
                        }
                      >
                        <ArrowUp size={UI_ICON_SIZE.regular} />
                      </Button>
                      <Button
                        size="icon"
                        disabled={movable.at(-1)?.label === category.label}
                        accessibilityLabel={t("settings.categories.moveDown", {
                          category: category.label,
                        })}
                        onPress={() =>
                          onReorder(
                            moveCategory(
                              categories.map((item) => item.label),
                              category.label,
                              1
                            )
                          )
                        }
                      >
                        <ArrowDown size={UI_ICON_SIZE.regular} />
                      </Button>
                    </>
                  ) : null}
                </View>
              ) : (
                <CategoryListItem
                  category={category}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  expenseCount={getExpenseCount?.(category.label) ?? 0}
                  canDelete={category.label !== "Other"}
                />
              )}
            </View>
          ))}
          <Text className="text-xs text-muted-foreground">
            {t("settings.categories.otherHelp")}
          </Text>
        </View>
      ) : (
        <Text className="text-sm text-muted-foreground">
          {t("settings.categories.description")}
        </Text>
      )}
    </View>
  )
})

export type { CategorySectionProps }
