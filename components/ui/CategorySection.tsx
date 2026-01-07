import { useCallback, useMemo, memo } from "react"
import { YStack, XStack, Text, Button, Accordion } from "tamagui"
import { ViewStyle } from "react-native"
import { Plus, ChevronDown, ChevronUp } from "@tamagui/lucide-icons"
import { Category } from "../../types/category"
import { CategoryListItem } from "./CategoryListItem"
import { SettingsSection } from "./SettingsSection"

// Layout styles
const layoutStyles = {
  accordionTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  } as ViewStyle,
  accordionTriggerInner: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  } as ViewStyle,
  accordionContent: {
    padding: 8,
    paddingTop: 12,
  } as ViewStyle,
  categoryList: {
    gap: 4,
  } as ViewStyle,
  reorderButtons: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    paddingRight: 4,
  } as ViewStyle,
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  } as ViewStyle,
  addButtonContainer: {
    marginTop: 16,
  } as ViewStyle,
}

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
 * Displays category list with add, edit, delete, and reorder functionality
 */
export const CategorySection = memo(function CategorySection({
  categories,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  getExpenseCount,
}: CategorySectionProps) {
  // Sort categories by order - memoized to avoid re-sorting on every render
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  // Handle move up
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return
      const labels = sortedCategories.map((c) => c.label)
      // Swap with previous
      const temp = labels[index]
      labels[index] = labels[index - 1]
      labels[index - 1] = temp
      onReorder(labels)
    },
    [sortedCategories, onReorder]
  )

  // Handle move down
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= sortedCategories.length - 1) return
      const labels = sortedCategories.map((c) => c.label)
      // Swap with next
      const temp = labels[index]
      labels[index] = labels[index + 1]
      labels[index + 1] = temp
      onReorder(labels)
    },
    [sortedCategories, onReorder]
  )

  return (
    <SettingsSection title="CATEGORIES">
      <Text color="$color" opacity={0.7} fontSize="$3">
        Customize expense categories to match your spending habits.
      </Text>

      <Accordion type="single" collapsible defaultValue={undefined}>
        <Accordion.Item value="category-list">
          <Accordion.Trigger bg="$backgroundHover" style={layoutStyles.accordionTrigger}>
            {({ open }: { open: boolean }) => (
              <>
                <XStack style={layoutStyles.accordionTriggerInner}>
                  <Text fontWeight="500">Manage Categories</Text>
                  <Text fontSize="$2" color="$color" opacity={0.6}>
                    ({categories.length})
                  </Text>
                </XStack>
                <ChevronDown
                  size={18}
                  style={{
                    transform: [{ rotate: open ? "180deg" : "0deg" }],
                  }}
                />
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content style={layoutStyles.accordionContent}>
            <YStack gap="$3">
              {/* Category list */}
              <YStack style={layoutStyles.categoryList}>
                {sortedCategories.map((category, index) => (
                  <XStack key={category.label} style={layoutStyles.categoryRow}>
                    {/* Reorder buttons - compact vertical layout */}
                    <YStack style={layoutStyles.reorderButtons}>
                      <Button
                        size="$1"
                        chromeless
                        icon={<ChevronUp size={14} />}
                        onPress={() => handleMoveUp(index)}
                        disabled={index === 0}
                        opacity={index === 0 ? 0.3 : 0.7}
                        aria-label={`Move ${category.label} up`}
                      />
                      <Button
                        size="$1"
                        chromeless
                        icon={<ChevronDown size={14} />}
                        onPress={() => handleMoveDown(index)}
                        disabled={index === sortedCategories.length - 1}
                        opacity={index === sortedCategories.length - 1 ? 0.3 : 0.7}
                        aria-label={`Move ${category.label} down`}
                      />
                    </YStack>

                    {/* Category item */}
                    <YStack flex={1}>
                      <CategoryListItem
                        category={category}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        expenseCount={getExpenseCount?.(category.label) ?? 0}
                        canDelete={category.label !== "Other"}
                      />
                    </YStack>
                  </XStack>
                ))}
              </YStack>

              {/* Add Category button */}
              <YStack style={layoutStyles.addButtonContainer}>
                <Button
                  size="$4"
                  onPress={onAdd}
                  icon={<Plus size={18} />}
                  themeInverse
                  pressStyle={{ opacity: 0.7 }}
                >
                  Add Category
                </Button>
              </YStack>
            </YStack>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </SettingsSection>
  )
})

export type { CategorySectionProps }
