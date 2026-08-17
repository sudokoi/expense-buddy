import { memo, useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { Button } from "../ui/Button"
import { useCategories } from "../../stores/hooks"
import { CATEGORY_ICON_MAP } from "../../constants/category-icons"
import { useTranslation } from "react-i18next"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { UI_SPACE } from "../../constants/ui-tokens"

interface CategoryFilterProps {
  selectedCategories: string[]
  onChange: (categories: string[]) => void
}

const styles = {
  scrollView: {
    marginBottom: UI_SPACE.gutter,
  },
  contentContainer: {
    paddingHorizontal: UI_SPACE.micro,
  },
} as const

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
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <View className="flex-row gap-2">
        {/* All button */}
        <Button
          size="chip"
          className="px-2"
          variant={isAllSelected ? "accent" : "outline"}
          onPress={handleAllPress}
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
            >
              <Icon size={14} color={isSelected ? "white" : theme.foreground} />
              <Text className={isSelected ? "text-white" : "text-foreground"}>
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
