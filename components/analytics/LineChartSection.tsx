import { useMemo, memo, useCallback } from "react"
import { Dimensions, ScrollView, Text, View } from "react-native"
import { LineChart } from "react-native-gifted-charts"
import { CollapsibleSection } from "./CollapsibleSection"
import type { LineChartDataItem } from "../../utils/analytics/aggregations"
import { ACCENT_COLORS, getChartColors, getOverlayColors } from "../../constants/palette"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"
import { useTranslation } from "react-i18next"
import { getCurrencySymbol } from "../../utils/currency"
import {
  UI_RADIUS,
  UI_SPACE,
  UI_OPACITY,
  UI_BORDER_WIDTH,
} from "../../constants/ui-tokens"

interface LineChartSectionProps {
  data: LineChartDataItem[]
  currencyCode?: string
}

/**
 * LineChartSection - Line chart with bar overlay showing spending trends
 * Wrapped in CollapsibleSection, supports horizontal scrolling and tooltips
 */
export const LineChartSection = memo(function LineChartSection({
  data,
  currencyCode = "INR",
}: LineChartSectionProps) {
  const { t } = useTranslation()
  const symbol = getCurrencySymbol(currencyCode)
  const theme = useThemeColors()
  const colorScheme = useThemeScheme()
  const chartColors = getChartColors(colorScheme)
  const overlayColors = getOverlayColors(colorScheme)
  const screenWidth = Dimensions.get("window").width

  // Memoize styles with theme colors
  const styles = useMemo(
    () => ({
      tooltipContainer: {
        backgroundColor: overlayColors.background,
        padding: UI_SPACE.control,
        borderRadius: UI_RADIUS.control,
        borderWidth: UI_BORDER_WIDTH.thin,
        borderColor: overlayColors.border,
        shadowColor: overlayColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
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

  // Default the scroll position to the right end so the latest spend trend is
  // visible first, instead of the oldest days on the left. Using a callback ref
  // fires once on mount, so users can still scroll back to the left afterwards.
  const scrollToLatest = useCallback((node: ScrollView | null) => {
    if (!node) return
    // Content isn't laid out at ref-attach time; defer to the next frame.
    requestAnimationFrame(() => node.scrollToEnd({ animated: false }))
  }, [])

  const scheme = useThemeScheme()

  // Memoize theme colors - use kawaii pink accent
  const colors = useMemo(
    () => ({
      line: theme.accent,
      area:
        scheme === "dark" ? ACCENT_COLORS.primaryLightDark : ACCENT_COLORS.primaryLight,
      text: theme.foreground,
    }),
    [theme.accent, theme.foreground, scheme]
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
        <View style={styles.tooltipContainer}>
          <Text className="text-[13px] font-bold">
            {symbol}
            {item.value.toFixed(2)}
          </Text>
        </View>
      )
    },
    [styles.tooltipContainer, symbol]
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
      <CollapsibleSection title={t("analytics.charts.trend.title")}>
        <View className="h-[150px] items-center justify-center">
          <Text className="text-foreground" style={{ opacity: UI_OPACITY.subtle }}>
            {t("analytics.charts.common.noData")}
          </Text>
        </View>
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
    <CollapsibleSection title={t("analytics.charts.trend.title")}>
      <View>
        {needsScroll ? (
          <ScrollView ref={scrollToLatest} horizontal showsHorizontalScrollIndicator>
            {chartContent}
          </ScrollView>
        ) : (
          chartContent
        )}
      </View>
    </CollapsibleSection>
  )
})

export type { LineChartSectionProps }
