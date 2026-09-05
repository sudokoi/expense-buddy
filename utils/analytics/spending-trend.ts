import { format, parseISO, startOfMonth, startOfWeek } from "date-fns"
import type { Locale } from "date-fns"
import type { LineChartDataItem } from "./aggregations"

export type TrendGranularity = "daily" | "weekly" | "monthly"

export interface SpendingTrendPoint {
  value: number
  date: string
  endDate: string
  label: string
  periodLabel: string
}

/** Build readable buckets from the chronological, zero-filled daily series. */
export function buildSpendingTrend(data: LineChartDataItem[], locale: Locale) {
  const granularity: TrendGranularity =
    data.length <= 45 ? "daily" : data.length <= 180 ? "weekly" : "monthly"
  const buckets = new Map<string, { value: number; date: string; endDate: string }>()

  for (const item of data) {
    const date = parseISO(item.date)
    const bucketStart =
      granularity === "monthly"
        ? startOfMonth(date)
        : granularity === "weekly"
          ? startOfWeek(date, { locale })
          : date
    const key = format(bucketStart, "yyyy-MM-dd")
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.value += item.value
      bucket.endDate = item.date
    } else {
      buckets.set(key, { value: item.value, date: item.date, endDate: item.date })
    }
  }

  const points: SpendingTrendPoint[] = Array.from(buckets.values(), (bucket) => {
    const start = parseISO(bucket.date)
    const end = parseISO(bucket.endDate)
    return {
      ...bucket,
      label: format(start, granularity === "monthly" ? "MMM yy" : "d MMM", { locale }),
      // Use actual covered dates so partial weeks/months aren't presented as full periods.
      periodLabel:
        bucket.date === bucket.endDate
          ? format(start, "PP", { locale })
          : `${format(start, "PP", { locale })} – ${format(end, "PP", { locale })}`,
    }
  })

  return { granularity, points }
}

/** Zero-based scale with four readable steps and headroom; never clip an outlier. */
export function getTrendScale(points: { value: number }[]) {
  const peak = points.reduce((max, point) => Math.max(max, point.value), 0)
  const rawStep = Math.max((peak * 1.1) / 4, 0.01)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const stepValue = Math.ceil(rawStep / magnitude) * magnitude
  return { stepValue, maxValue: stepValue * 4 }
}
