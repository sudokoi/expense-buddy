import { memo, useCallback } from "react"
import { XStack, Button } from "tamagui"
import { ScrollView, ViewStyle } from "react-native"
import { ExpenseCategory } from "../../types/expense"
import { CATEGORIES } from "../../constants/categories"
import { getColorValue } from "../../tamagui.config"

interface CategoryFilterProps {
  selectedCategories: ExpenseCategory[]
  onChange: (categories: ExpenseCategory[]) => void
}

const styles = {
  scrollView: {
    marginBottom: 16,
  } as ViewStyle,
  contentContainer: {
    paddingHorizontal: 4,
  } as ViewStyle,
}

/**
 * CategoryFilter - Multi-select category chips for filtering analytics
 * Includes "All" option to reset selection, uses category colors for styling
 */
export const CategoryFilter = memo(function CategoryFilter({
  selectedCategories,
  onChange,
}: CategoryFilterProps) {
  const isAllSelected = selectedCategories.length === 0

  const handleAllPress = useCallback(() => {
    onChange([])
  }, [onChange])

  const handleCategoryPress = useCallback(
    (category: ExpenseCategory) => {
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
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      <XStack gap="$2">
        {/* All button */}
        <Button
          size="$2"
          themeInverse={isAllSelected}
          bordered={!isAllSelected}
          onPress={handleAllPress}
        >
          All
        </Button>

        {/* Category chips */}
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat.value)
          const Icon = cat.icon
          return (
            <Button
              key={cat.value}
              size="$2"
              bordered={!isSelected}
              style={
                isSelected ? { backgroundColor: getColorValue(cat.color) } : undefined
              }
              onPress={() => handleCategoryPress(cat.value)}
              icon={<Icon size={14} color={isSelected ? "white" : "$color"} />}
            >
              <Button.Text color={isSelected ? "white" : "$color"}>
                {cat.label}
              </Button.Text>
            </Button>
          )
        })}
      </XStack>
    </ScrollView>
  )
})

export type { CategoryFilterProps }
