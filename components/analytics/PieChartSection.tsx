import { useState, useMemo, useCallback, memo } from "react"
import { YStack, XStack, Text, View } from "tamagui"
import { PieChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import { PieChartDataItem } from "../../utils/analytics-calculations"
import { Dimensions, ViewStyle, Pressable, useColorScheme } from "react-native"
import { getChartColors } from "../../constants/theme-colors"
import { useTranslation } from "react-i18next"

interface PieChartSectionProps {
  data: PieChartDataItem[]
  onCategorySelect?: (category: string | null) => void
}

const styles = {
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 150,
  } as ViewStyle,
  chartContainer: {
    alignItems: "center",
    gap: 16,
  } as ViewStyle,
  centerLabel: {
    alignItems: "center",
  } as ViewStyle,
  legendRow: {
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    borderRadius: 4,
  } as ViewStyle,
  legendLeft: {
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  legendRight: {
    gap: 8,
    alignItems: "center",
  } as ViewStyle,
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  } as ViewStyle,
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
        style={[
          styles.legendRow,
          isSelected ? { backgroundColor: selectedBgColor } : undefined,
        ]}
      >
        <XStack style={styles.legendLeft}>
          <View style={[styles.colorDot, { backgroundColor: item.color }]} />
          <Text fontWeight={isSelected ? "bold" : "normal"}>{item.text}</Text>
        </XStack>
        <XStack style={styles.legendRight}>
          <Text color="$color" opacity={0.6}>
            {item.percentage.toFixed(1)}%
          </Text>
          <Text fontWeight="bold">₹{item.value.toFixed(2)}</Text>
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
      <YStack style={styles.centerLabel}>
        <Text fontSize="$2" color="$color" opacity={0.6}>
          {t("analytics.charts.common.total")}
        </Text>
        <Text fontWeight="bold" fontSize="$4">
          ₹{total.toFixed(0)}
        </Text>
      </YStack>
    ),
    [total, t]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title={t("analytics.charts.category.title")}>
        <YStack style={styles.emptyContainer}>
          <Text color="$color" opacity={0.6}>
            {t("analytics.charts.common.noData")}
          </Text>
        </YStack>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title={t("analytics.charts.category.title")}>
      <YStack style={styles.chartContainer}>
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

        <YStack width="100%" gap="$2">
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
