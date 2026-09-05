import { useMemo, memo, useCallback, useEffect, useRef, useState } from "react"
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { LineChart } from "react-native-gifted-charts"
import { useTranslation } from "react-i18next"
import { CollapsibleSection } from "./CollapsibleSection"
import { getTrendScale, type SpendingTrend } from "../../utils/analytics/spending-trend"
import { getChartColors } from "../../constants/palette"
import { useThemeColors, useThemeScheme } from "../../hooks/use-theme-colors"
import { formatCurrency } from "../../utils/currency"
import { UI_ICON_SIZE, UI_FONT_SIZE } from "../../constants/ui-tokens"

interface LineChartSectionProps {
  data: SpendingTrend
  currencyCode?: string
  /** Month selections start at the beginning; rolling windows show the latest point. */
  autoScrollToEnd?: boolean
}

const CHART_HEIGHT = 160
const Y_AXIS_WIDTH = 64
const EDGE_SPACING = 24
// Gifted Charts bottom-anchors a single-line X-axis label using an 18dp line box.
const X_AXIS_LABEL_HEIGHT = 18

export const LineChartSection = memo(function LineChartSection({
  data,
  currencyCode = "INR",
  autoScrollToEnd = true,
}: LineChartSectionProps) {
  const { t, i18n } = useTranslation()
  const theme = useThemeColors()
  const { fontScale } = useWindowDimensions()
  const yAxisWidth = Y_AXIS_WIDTH * fontScale
  const chartColors = getChartColors(useThemeScheme())
  const { points, granularity } = data
  const [containerWidth, setContainerWidth] = useState(0)
  const [selection, setSelection] = useState<{ range: string; date: string } | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const rangeKey = `${currencyCode}:${granularity}:${points[0]?.date}:${points.at(-1)?.endDate}:${autoScrollToEnd}`
  const selectionIndex =
    selection?.range === rangeKey
      ? points.findIndex((point) => point.date === selection.date)
      : -1
  const selectedIndex =
    selectionIndex >= 0 ? selectionIndex : autoScrollToEnd ? points.length - 1 : 0
  const selectedPoint = points[selectedIndex]

  // The library owns horizontal scrolling so the Y axis stays fixed in the viewport.
  // Reserve its end spacing as well as the Y-axis label width inside the measured card.
  const chartWidth = Math.max(0, containerWidth - yAxisWidth - EDGE_SPACING - 8)
  const spacing = Math.max(
    32,
    (chartWidth - EDGE_SPACING) / Math.max(points.length - 1, 1)
  )
  const labelInterval = Math.max(1, Math.ceil((72 * fontScale) / spacing))
  const chartData = useMemo(
    () =>
      points.map((point, index) => ({
        value: point.value,
        label: index % labelInterval === 0 ? point.label : "",
      })),
    [points, labelInterval]
  )
  const scale = useMemo(() => getTrendScale(points), [points])
  const total = useMemo(
    () => points.reduce((sum, point) => sum + point.value, 0),
    [points]
  )
  const axisFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || "en-IN", {
        style: "currency",
        currency: currencyCode,
        notation: "compact",
        maximumFractionDigits: 2,
      }),
    [i18n.language, currencyCode]
  )
  const formatYLabel = useCallback(
    (label: string) => axisFormatter.format(Number(label)),
    [axisFormatter]
  )
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width)
  }, [])
  const selectPoint = useCallback(
    (index: number) => {
      const point = points[index]
      if (!point) return
      setSelection({ range: rangeKey, date: point.date })
    },
    [points, rangeKey]
  )
  const handleFocus = useCallback(
    (_item: unknown, index: number) => selectPoint(index),
    [selectPoint]
  )

  // Keep tap-button navigation and filter changes in sync with the visible plot.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x: Math.max(0, EDGE_SPACING + selectedIndex * spacing - chartWidth / 2),
        animated: false,
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedIndex, spacing, chartWidth, rangeKey])

  return (
    <CollapsibleSection title={t("analytics.charts.trend.title")}>
      {!selectedPoint ? (
        <View className="h-chart-empty items-center justify-center">
          <Text className="text-muted-foreground">
            {t("analytics.charts.common.noData")}
          </Text>
        </View>
      ) : (
        <View onLayout={handleLayout} className="gap-3">
          <View className="gap-1">
            <Text className="text-xs text-muted-foreground">
              {t(`analytics.charts.trend.${granularity}`)}
            </Text>
            <Text className="text-sm text-foreground">
              {t("analytics.charts.trend.periodTotal", {
                total: formatCurrency(total, currencyCode),
              })}
            </Text>
          </View>

          {chartWidth > 0 ? (
            <View
              accessible
              accessibilityLabel={t("analytics.charts.trend.accessibilityLabel", {
                total: formatCurrency(total, currencyCode),
              })}
            >
              <LineChart
                key={rangeKey}
                scrollRef={scrollRef}
                scrollToEnd={autoScrollToEnd}
                scrollAnimation={false}
                showScrollIndicator
                data={chartData}
                width={chartWidth}
                height={CHART_HEIGHT}
                spacing={spacing}
                initialSpacing={EDGE_SPACING}
                endSpacing={EDGE_SPACING}
                color={theme.accent}
                thickness={2}
                areaChart
                startFillColor={theme.accent}
                endFillColor={theme.accent}
                startOpacity={0.12}
                endOpacity={0}
                dataPointsColor={theme.accent}
                dataPointsRadius={2}
                focusEnabled
                onFocus={handleFocus}
                focusedDataPointIndex={selectedIndex}
                unFocusOnPressOut={false}
                showDataPointOnFocus
                focusedDataPointRadius={5}
                focusedDataPointColor={theme.accent}
                showStripOnFocus
                stripColor={chartColors.axisLine}
                stripWidth={1}
                xAxisColor={chartColors.axisLine}
                yAxisThickness={0}
                yAxisLabelWidth={yAxisWidth}
                formatYLabel={formatYLabel}
                yAxisTextStyle={{
                  color: theme.mutedForeground,
                  fontSize: UI_FONT_SIZE.micro,
                }}
                xAxisLabelTextStyle={{
                  color: theme.mutedForeground,
                  fontSize: UI_FONT_SIZE.micro,
                }}
                xAxisLabelsHeight={X_AXIS_LABEL_HEIGHT * fontScale}
                // Offset added height downward; a taller bottom-anchored box otherwise
                // lifts the text above the axis instead of reserving space below it.
                xAxisLabelsVerticalShift={X_AXIS_LABEL_HEIGHT * (fontScale - 1)}
                labelsExtraHeight={12}
                noOfSections={4}
                maxValue={scale.maxValue}
                stepValue={scale.stepValue}
                showFractionalValues={scale.stepValue < 1}
                roundToDigits={2}
                rulesType="solid"
                rulesColor={chartColors.rules}
              />
            </View>
          ) : null}

          <View className="flex-row items-center gap-2 rounded-control bg-background p-2">
            <Pressable
              className="min-h-12 min-w-12 items-center justify-center rounded-control"
              accessibilityRole="button"
              accessibilityLabel={t("analytics.charts.trend.previous")}
              accessibilityState={{ disabled: selectedIndex <= 0 }}
              disabled={selectedIndex <= 0}
              onPress={() => selectPoint(selectedIndex - 1)}
              style={{ opacity: selectedIndex <= 0 ? 0.3 : 1 }}
            >
              <ChevronLeft size={UI_ICON_SIZE.medium} color={theme.foreground} />
            </Pressable>
            <View
              className="flex-1 items-center gap-1"
              accessibilityLiveRegion="polite"
              accessible
            >
              <Text className="text-center text-xs text-muted-foreground">
                {selectedPoint.periodLabel}
              </Text>
              <Text
                className="text-center text-base font-bold text-foreground"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatCurrency(selectedPoint.value, currencyCode)}
              </Text>
            </View>
            <Pressable
              className="min-h-12 min-w-12 items-center justify-center rounded-control"
              accessibilityRole="button"
              accessibilityLabel={t("analytics.charts.trend.next")}
              accessibilityState={{ disabled: selectedIndex >= points.length - 1 }}
              disabled={selectedIndex >= points.length - 1}
              onPress={() => selectPoint(selectedIndex + 1)}
              style={{ opacity: selectedIndex >= points.length - 1 ? 0.3 : 1 }}
            >
              <ChevronRight size={UI_ICON_SIZE.medium} color={theme.foreground} />
            </Pressable>
          </View>
          <Text className="text-xs text-muted-foreground">
            {t("analytics.charts.trend.hint")}
          </Text>
        </View>
      )}
    </CollapsibleSection>
  )
})

export type { LineChartSectionProps }
