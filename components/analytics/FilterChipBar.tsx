import type { ReactNode, ComponentType } from "react"
import { memo } from "react"
import { ScrollView, View } from "react-native"
import { Button } from "../ui/Button"

/**
 * Deep module for analytics filter chips — owns the horizontal ScrollView seam
 * and the selected-vs-outline variant logic so individual filters stay anemic
 * and keep only their data-mapping (`interface`).
 *
 * Benefits: locality (gap, paddingHorizontal, nestedScrollEnabled in one place),
 * leverage (adding a chip type touches data array, not 6 style branches),
 * testability (interface is items + onToggle).
 */

interface FilterChipBarProps {
  children: ReactNode
}

export const FilterChipBar = memo(function FilterChipBar({
  children,
}: FilterChipBarProps) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      className="mb-5"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      <View className="flex-row gap-2">{children}</View>
    </ScrollView>
  )
})

interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
  Icon?: ComponentType<{ size?: number }>
  iconSize?: number
}

export const FilterChip = memo(function FilterChip({
  label,
  selected,
  onPress,
  Icon,
  iconSize = 14,
}: FilterChipProps) {
  return (
    <Button
      size="chip"
      variant={selected ? "accent" : "outline"}
      icon={Icon ? <Icon size={iconSize} /> : undefined}
      onPress={onPress}
      accessibilityState={{ selected }}
    >
      {label}
    </Button>
  )
})
