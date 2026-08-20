import { memo, useCallback, useMemo } from "react"
import { Text } from "react-native"
import { useCategories } from "../../stores/hooks"
import { CATEGORY_ICON_MAP } from "../../constants/category-icons"
import { useTranslation } from "react-i18next"
import { FilterChip, FilterChipBar } from "./FilterChipBar"
import { Button } from "../ui/Button"

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
  const isAllSelected = selectedCategories.length === 0

  // Memoize category items with icons and pre-built selected style
  const categoryItems = useMemo(() => {
    return categories.map((cat) => {
      const IconComponent = CATEGORY_ICON_MAP[cat.icon] ?? CATEGORY_ICON_MAP.Circle
      return {
        label: cat.label,
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
    <FilterChipBar>
      <Button
        size="chip"
        variant={isAllSelected ? "accent" : "outline"}
        onPress={handleAllPress}
        accessibilityState={{ selected: isAllSelected }}
      >
        <Text>{t("common.all")}</Text>
      </Button>

      {categoryItems.map((cat) => {
        const isSelected = selectedCategories.includes(cat.label)
        return (
          <FilterChip
            key={cat.label}
            label={cat.label === "Other" ? t("settings.categories.other") : cat.label}
            selected={isSelected}
            onPress={() => handleCategoryPress(cat.label)}
            Icon={cat.Icon}
          />
        )
      })}
    </FilterChipBar>
  )
})

export type { CategoryFilterProps }
