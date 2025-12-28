import { useMemo, memo, useCallback } from "react"
import { YStack, Text, useTheme, Card } from "tamagui"
import { LineChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import { LineChartDataItem } from "../../utils/analytics-calculations"
import { Dimensions, ScrollView, ViewStyle } from "react-native"

interface LineChartSectionProps {
  data: LineChartDataItem[]
}

const styles = {
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 150,
  } as ViewStyle,
  tooltipContainer: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  } as ViewStyle,
}

const POINT_SPACING = 50

/**
 * LineChartSection - Line chart with bar overlay showing spending trends
 * Wrapped in CollapsibleSection, supports horizontal scrolling and tooltips
 */
export const LineChartSection = memo(function LineChartSection({
  data,
}: LineChartSectionProps) {
  const theme = useTheme()
  const screenWidth = Dimensions.get("window").width

  // Memoize chart dimensions
  const { chartWidth, needsScroll } = useMemo(() => {
    const width = Math.max(screenWidth - 80, data.length * POINT_SPACING)
    return {
      chartWidth: width,
      needsScroll: width > screenWidth - 60,
    }
  }, [screenWidth, data.length])

  // Memoize theme colors
  const colors = useMemo(
    () => ({
      line: theme.blue9?.val ?? "#3b82f6",
      area: theme.blue4?.val ?? "#93c5fd",
      text: theme.color?.val ?? "#000",
    }),
    [theme.blue9?.val, theme.blue4?.val, theme.color?.val]
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
  const PointerLabel = useCallback((items: { value: number }[]) => {
    const item = items[0]
    if (!item) return null
    return (
      <Card style={styles.tooltipContainer}>
        <Text fontWeight="bold" fontSize="$3">
          ₹{item.value.toFixed(2)}
        </Text>
      </Card>
    )
  }, [])

  // Memoize pointer config
  const pointerConfig = useMemo(
    () => ({
      pointerStripHeight: 200,
      pointerStripColor: "lightgray",
      pointerStripWidth: 2,
      pointerColor: colors.line,
      radius: 6,
      pointerLabelWidth: 100,
      pointerLabelHeight: 90,
      activatePointersOnLongPress: true,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: PointerLabel,
    }),
    [colors.line, PointerLabel]
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
      spacing={POINT_SPACING}
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
      verticalLinesColor="rgba(0,0,0,0.1)"
      xAxisColor="rgba(0,0,0,0.2)"
      yAxisColor="rgba(0,0,0,0.2)"
      yAxisTextStyle={{ color: colors.text, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: colors.text, fontSize: 10 }}
      noOfSections={4}
      maxValue={maxValue}
      rulesType="solid"
      rulesColor="rgba(0,0,0,0.05)"
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
