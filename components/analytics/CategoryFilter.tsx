import { memo, useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useCategories } from "../../stores/hooks"
import { CATEGORY_ICON_MAP } from "../../constants/category-icons"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { getReadableTextColor } from "../../constants/palette"

interface CategoryFilterProps {
  selectedCategories: string[]
  onChange: (categories: string[]) => void
}

/**
 * CategoryFilter - Multi-select category chips for filtering analytics
 * Includes "All" option to reset selection, uses dynamic category colors from store
 */
export const CategoryFilter = memo(function CategoryFilter({
  selectedCategories,
  onChange,
}: CategoryFilterProps) {
  const { categories } = useCategories()
  const { t } = useTranslation()
  const theme = useThemeColors()
  const isAllSelected = selectedCategories.length === 0

  // Memoize category items with icons and pre-built selected style
  const categoryItems = useMemo(() => {
    return categories.map((cat) => {
      const IconComponent = CATEGORY_ICON_MAP[cat.icon] ?? CATEGORY_ICON_MAP.Circle
      return {
        label: cat.label,
        color: cat.color,
        Icon: IconComponent,
        selectedStyle: { backgroundColor: cat.color },
        selectedTextColor: getReadableTextColor(cat.color),
      }
    })
  }, [categories])

  const handleAllPress = useCallback(() => {
    onChange([])
  }, [onChange])

  const handleCategoryPress = useCallback(
    (category: string) => {
      if (selectedCategories.includes(category)) {
        // Remove category from selection
        const newSelection = selectedCategories.filter((c) => c !== category)
        onChange(newSelection)
      } else {
        // Add category to selection
        onChange([...selectedCategories, category])
      }
    },
    [selectedCategories, onChange]
  )

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      className="mb-5"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      <View className="flex-row gap-2">
        {/* All button */}
        <Button
          size="chip"
          className="px-2"
          variant={isAllSelected ? "accent" : "outline"}
          onPress={handleAllPress}
          accessibilityState={{ selected: isAllSelected }}
        >
          <Text>{t("common.all")}</Text>
        </Button>

        {/* Category chips */}
        {categoryItems.map((cat) => {
          const isSelected = selectedCategories.includes(cat.label)
          const Icon = cat.Icon
          return (
            <Button
              key={cat.label}
              size="chip"
              className={`gap-1 px-2${isSelected ? "" : " border border-border"}`}
              style={isSelected ? cat.selectedStyle : undefined}
              onPress={() => handleCategoryPress(cat.label)}
              accessibilityState={{ selected: isSelected }}
            >
              <Icon
                size={14}
                color={isSelected ? cat.selectedTextColor : theme.foreground}
              />
              <Text
                className={isSelected ? undefined : "text-foreground"}
                style={isSelected ? { color: cat.selectedTextColor } : undefined}
              >
                {cat.label === "Other" ? t("settings.categories.other") : cat.label}
              </Text>
            </Button>
          )
        })}
      </View>
    </ScrollView>
  )
})

export type { CategoryFilterProps }
