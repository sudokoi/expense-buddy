import { Card, Text } from "tamagui"
import { ReactNode } from "react"

interface CategoryCardProps {
  isSelected: boolean
  categoryColor: string
  label: string
  onPress: () => void
  children?: ReactNode
}

/**
 * CategoryCard - A styled Card for category selection
 * Provides consistent styling for category selection cards with selected/unselected states
 */
export function CategoryCard({
  isSelected,
  categoryColor,
  label,
  onPress,
}: CategoryCardProps) {
  return (
    <Card
      bordered
      animation="bouncy"
      scale={0.97}
      hoverStyle={{ scale: 1 }}
      pressStyle={{ scale: 0.95 }}
      backgroundColor={isSelected ? (categoryColor as any) : "$background"}
      borderColor={isSelected ? (categoryColor as any) : "$borderColor"}
      padding="$3"
      borderRadius="$4"
      width="30%"
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
    >
      <Text
        fontWeight={isSelected ? "bold" : "normal"}
        color={isSelected ? "white" : "$color"}
      >
        {label}
      </Text>
    </Card>
  )
}

export type { CategoryCardProps }
