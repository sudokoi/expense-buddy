import { memo, useCallback, useMemo } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView, ViewStyle } from "react-native"
import { useCategories } from "../../stores/hooks"
import { CATEGORY_ICON_MAP } from "../../constants/category-icons"
import { useTranslation } from "react-i18next"
import { UI_SPACE } from "../../constants/ui-tokens"

interface CategoryFilterProps {
  selectedCategories: string[]
  onChange: (categories: string[]) => void
}

const styles = {
  scrollView: {
    marginBottom: UI_SPACE.gutter,
  } as ViewStyle,
  contentContainer: {
    paddingHorizontal: UI_SPACE.micro,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,
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
  const isAllSelected = selectedCategories.length === 0

  // Memoize category items with icons
  const categoryItems = useMemo(() => {
    return categories.map((cat) => {
      const IconComponent = CATEGORY_ICON_MAP[cat.icon] ?? CATEGORY_ICON_MAP.Circle
      return {
        label: cat.label,
        color: cat.color,
        Icon: IconComponent,
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
      <XStack gap="$control">
        {/* All button */}
        <Button
          size="$chip"
          px="$control"
          theme={isAllSelected ? "accent" : undefined}
          borderColor="$borderColor"
          borderWidth={!isAllSelected ? 1 : 0}
          onPress={handleAllPress}
        >
          {t("common.all")}
        </Button>

        {/* Category chips */}
        {categoryItems.map((cat) => {
          const isSelected = selectedCategories.includes(cat.label)
          const Icon = cat.Icon
          return (
            <Button
              key={cat.label}
              size="$chip"
              px="$control"
              borderColor="$borderColor"
              borderWidth={!isSelected ? 1 : 0}
              style={isSelected ? { backgroundColor: cat.color } : undefined}
              onPress={() => handleCategoryPress(cat.label)}
              icon={<Icon size={14} color={isSelected ? "white" : "$color"} />}
            >
              <Button.Text color={isSelected ? "white" : "$color"}>
                {cat.label === "Other" ? t("settings.categories.other") : cat.label}
              </Button.Text>
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { CategoryFilterProps }
