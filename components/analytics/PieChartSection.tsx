import { useState, useMemo, useCallback, memo } from "react"
import { YStack, XStack, Text, View } from "tamagui"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PieChartDataItem } from "../../utils/analytics/aggregations"
import { Dimensions, ViewStyle, Pressable, useColorScheme } from "react-native"
import { getChartColors } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
} from "../../constants/ui-tokens"

interface PieChartSectionProps {
  data: PieChartDataItem[]
  onCategorySelect?: (category: string | null) => void
}

// Memoized legend item component
const LegendItem = memo(function LegendItem({
  item,
  isSelected,
  selectedBgColor,
  onPress,
}: {
  item: PieChartDataItem
  isSelected: boolean
  selectedBgColor: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        justify="space-between"
        items="center"
        p={UI_SPACE.control}
        rounded={UI_RADIUS.control}
        style={isSelected ? { backgroundColor: selectedBgColor } : undefined}
      >
        <XStack items="center" gap={UI_SPACE.control}>
          <View width={12} height={12} rounded={UI_RADIUS.control} style={{ backgroundColor: item.color }} />
          <Text fontWeight={isSelected ? UI_FONT_WEIGHT.bold : UI_FONT_WEIGHT.normal}>
            {item.text}
          </Text>
        </XStack>
        <XStack gap={UI_SPACE.control} items="center">
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {item.percentage.toFixed(1)}%
          </Text>
          <Text fontWeight={UI_FONT_WEIGHT.bold}>₹{item.value.toFixed(2)}</Text>
        </XStack>
      </XStack>
    </Pressable>
  )
})

/**
 * PieChartSection - Pie chart with legend showing expense distribution by category
 * Wrapped in CollapsibleSection, supports tap to highlight category
 */
export const PieChartSection = memo(function PieChartSection({
  data,
  onCategorySelect,
}: PieChartSectionProps) {
  const { t } = useTranslation()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const screenWidth = Dimensions.get("window").width
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useColorScheme() ?? "light"
  const chartColors = getChartColors(colorScheme)

  const handleSegmentPress = useCallback(
    (category: string) => {
      const newSelection = selectedCategory === category ? null : category
      setSelectedCategory(newSelection)
      onCategorySelect?.(newSelection)
    },
    [selectedCategory, onCategorySelect]
  )

  // Memoize chart data transformation
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        value: item.value,
        color: item.color,
        text: `${item.percentage.toFixed(0)}%`,
        focused: selectedCategory === item.category,
        onPress: () => handleSegmentPress(item.category),
      })),
    [data, selectedCategory, handleSegmentPress]
  )

  // Memoize total calculation
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  // Memoize center label component
  const CenterLabel = useCallback(
    () => (
      <YStack items="center">
        <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text fontWeight={UI_FONT_WEIGHT.bold} fontSize="$label">
          ₹{total.toFixed(0)}
        </Text>
      </YStack>
    ),
    [total, t]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.category.title")}>
        <YStack items="center" justify="center" height={150}>
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {t("analytics.charts.common.noData")}
          </Text>
        </YStack>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.category.title")}>
      <YStack items="center" gap={UI_SPACE.gutter}>
        <View>
          <PieChart
            data={chartData}
            donut
            radius={chartSize / 2}
            innerRadius={chartSize / 3}
            innerCircleColor="$background"
            centerLabelComponent={CenterLabel}
            focusOnPress
            showText
            textColor="white"
            textSize={10}
          />
        </View>

        <YStack width="100%" gap="$control">
          {data.map((item) => (
            <LegendItem
              key={item.category}
              item={item}
              isSelected={selectedCategory === item.category}
              selectedBgColor={chartColors.selectedBg}
              onPress={() => handleSegmentPress(item.category)}
            />
          ))}
        </YStack>
      </YStack>
    </CollapsibleSection>
  )
})

export type { PieChartSectionProps }
