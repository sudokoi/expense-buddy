import { memo, useCallback } from "react"
import { useCategories } from "../../stores/hooks"
import { CATEGORY_ICON_MAP } from "../../constants/category-icons"
import { useTranslation } from "react-i18next"
import { FilterChip, FilterChipBar } from "./FilterChipBar"

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
      <FilterChip
        label={t("common.all")}
        selected={isAllSelected}
        onPress={handleAllPress}
      />

      {categories.map((cat) => {
        const isSelected = selectedCategories.includes(cat.label)
        return (
          <FilterChip
            key={cat.label}
            label={cat.label === "Other" ? t("settings.categories.other") : cat.label}
            selected={isSelected}
            categoryColor={cat.color}
            Icon={CATEGORY_ICON_MAP[cat.icon] ?? CATEGORY_ICON_MAP.Circle}
            onPress={() => handleCategoryPress(cat.label)}
          />
        )
      })}
    </FilterChipBar>
  )
})

export type { CategoryFilterProps }
