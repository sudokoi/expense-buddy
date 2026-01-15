import { useMemo, memo, useCallback } from "react"
import { YStack, Text, useTheme, Card } from "tamagui"
import { LineChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import { LineChartDataItem } from "../../utils/analytics-calculations"
import { Dimensions, ScrollView, ViewStyle, useColorScheme } from "react-native"
import {
  ACCENT_COLORS,
  getChartColors,
  getOverlayColors,
} from "../../constants/theme-colors"
import { getColorValue } from "../../tamagui.config"

interface LineChartSectionProps {
  data: LineChartDataItem[]
}

/**
 * LineChartSection - Line chart with bar overlay showing spending trends
 * Wrapped in CollapsibleSection, supports horizontal scrolling and tooltips
 */
export const LineChartSection = memo(function LineChartSection({
  data,
}: LineChartSectionProps) {
  const theme = useTheme()
  const colorScheme = useColorScheme() ?? "light"
  const chartColors = getChartColors(colorScheme)
  const overlayColors = getOverlayColors(colorScheme)
  const screenWidth = Dimensions.get("window").width

  // Memoize styles with theme colors
  const styles = useMemo(
    () => ({
      emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        height: 150,
      } as ViewStyle,
      tooltipContainer: {
        backgroundColor: overlayColors.background,
        padding: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: overlayColors.border,
        shadowColor: overlayColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      } as ViewStyle,
    }),
    [overlayColors]
  )

  // Memoize chart dimensions
  const { chartWidth, needsScroll, pointSpacing } = useMemo(() => {
    // Prevent extreme scroll widths for large ranges (e.g. "all" with years of data)
    const spacing =
      data.length > 365 ? 12 : data.length > 180 ? 18 : data.length > 90 ? 28 : 50
    const width = Math.max(screenWidth - 80, data.length * spacing)
    return {
      chartWidth: width,
      needsScroll: width > screenWidth - 60,
      pointSpacing: spacing,
    }
  }, [screenWidth, data.length])

  // Memoize theme colors - use kawaii pink accent
  const colors = useMemo(
    () => ({
      line: theme.pink9?.val ?? ACCENT_COLORS.primary,
      area: theme.pink4?.val ?? ACCENT_COLORS.primaryLight,
      text: theme.color?.val ?? getColorValue(theme.color),
    }),
    [theme.pink9?.val, theme.pink4?.val, theme.color]
  )

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    const labelInterval = Math.ceil(data.length / 7)
    return data.map((item, index) => ({
      value: item.value,
      label: index % labelInterval === 0 ? item.label : "",
      dataPointText: item.dataPointText,
      labelTextStyle: { color: colors.text, fontSize: 10 },
    }))
  }, [data, colors.text])

  // Memoize max value calculation
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1) * 1.1, [data])

  // Memoize pointer label component
  const PointerLabel = useCallback(
    (items: { value: number }[]) => {
      const item = items[0]
      if (!item) return null
      return (
        <Card style={styles.tooltipContainer}>
          <Text fontWeight="bold" fontSize="$3">
            ₹{item.value.toFixed(2)}
          </Text>
        </Card>
      )
    },
    [styles.tooltipContainer]
  )

  // Memoize pointer config
  const pointerConfig = useMemo(
    () => ({
      pointerStripHeight: 200,
      pointerStripColor: chartColors.axisLine,
      pointerStripWidth: 2,
      pointerColor: colors.line,
      radius: 6,
      pointerLabelWidth: 100,
      pointerLabelHeight: 90,
      activatePointersOnLongPress: true,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: PointerLabel,
    }),
    [colors.line, chartColors.axisLine, PointerLabel]
  )

  if (data.length === 0) {
    return (
      <CollapsibleSection title="Spending Trend">
        <YStack style={styles.emptyContainer}>
          <Text color="$color" opacity={0.6}>
            No expense data for this period
          </Text>
        </YStack>
      </CollapsibleSection>
    )
  }

  const chartContent = (
    <LineChart
      data={chartData}
      width={needsScroll ? chartWidth : screenWidth - 100}
      height={200}
      spacing={pointSpacing}
      initialSpacing={20}
      endSpacing={20}
      color={colors.line}
      thickness={2}
      startFillColor={colors.area}
      endFillColor={colors.area}
      startOpacity={0.4}
      endOpacity={0.1}
      areaChart
      curved
      hideDataPoints={false}
      dataPointsColor={colors.line}
      dataPointsRadius={4}
      showVerticalLines
      verticalLinesColor={chartColors.gridLine}
      xAxisColor={chartColors.axisLine}
      yAxisColor={chartColors.axisLine}
      yAxisTextStyle={{ color: colors.text, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: colors.text, fontSize: 10 }}
      noOfSections={4}
      maxValue={maxValue}
      rulesType="solid"
      rulesColor={chartColors.rules}
      pointerConfig={pointerConfig}
    />
  )

  return (
    <CollapsibleSection title="Spending Trend">
      <YStack>
        {needsScroll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            {chartContent}
          </ScrollView>
        ) : (
          chartContent
        )}
      </YStack>
    </CollapsibleSection>
  )
})

export type { LineChartSectionProps }
