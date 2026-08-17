import { useState, useMemo, useCallback, memo } from "react"
import { Pressable, Text, View, useColorScheme, useWindowDimensions } from "react-native"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { PieChartDataItem } from "../../utils/analytics/aggregations"
import { getChartColors } from "../../constants/theme-colors"
import { useThemeColors } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { UI_OPACITY } from "../../constants/ui-tokens"

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
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${item.text}, ${item.percentage.toFixed(1)}%, ₹${item.value.toFixed(2)}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        className="flex-row items-center justify-between rounded-control p-2"
        style={isSelected ? { backgroundColor: selectedBgColor } : undefined}
      >
        <View className="flex-row items-center gap-2">
          <View
            className="h-3 w-3 rounded-control"
            style={{ backgroundColor: item.color }}
          />
          <Text className={`${isSelected ? "font-bold" : "font-normal"} text-foreground`}>
            {item.text}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {item.percentage.toFixed(1)}%
          </Text>
          <Text className="font-bold text-foreground">₹{item.value.toFixed(2)}</Text>
        </View>
      </View>
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
  const theme = useThemeColors()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { width: screenWidth } = useWindowDimensions()
  const chartSize = Math.min(screenWidth - 80, 200)
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light"
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
      <View className="items-center">
        <Text className="text-xs text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text className="text-sm font-bold text-foreground">₹{total.toFixed(0)}</Text>
      </View>
    ),
    [total, t]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.category.title")}>
        <View className="h-[150px] items-center justify-center">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {t("analytics.charts.common.noData")}
          </Text>
        </View>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.category.title")}>
      <View className="items-center gap-4">
        <View>
          <PieChart
            data={chartData}
            donut
            radius={chartSize / 2}
            innerRadius={chartSize / 3}
            innerCircleColor={theme.background}
            centerLabelComponent={CenterLabel}
            focusOnPress
            showText
            textColor="white"
            textSize={10}
          />
        </View>

        <View className="w-full gap-2">
          {data.map((item) => (
            <LegendItem
              key={item.category}
              item={item}
              isSelected={selectedCategory === item.category}
              selectedBgColor={chartColors.selectedBg}
              onPress={() => handleSegmentPress(item.category)}
            />
          ))}
        </View>
      </View>
    </CollapsibleSection>
  )
})

export type { PieChartSectionProps }
