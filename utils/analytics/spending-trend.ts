import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns"
import type { Locale } from "date-fns"
import type { DateRange } from "../../types/analytics"
import type { Expense } from "../../types/expense"

export type TrendGranularity = "daily" | "weekly" | "monthly"
export interface SpendingTrendPoint {
  value: number
  date: string
  endDate: string
  label: string
  periodLabel: string
}
export interface SpendingTrend {
  granularity: TrendGranularity
  points: SpendingTrendPoint[]
}

/** O(expenses + displayed buckets), with local-day and partial-period semantics. */
export function aggregateSpendingTrend(
  expenses: Pick<Expense, "date" | "amount">[],
  range: DateRange,
  locale: Locale
): SpendingTrend {
  const start = startOfDay(range.start)
  const end = endOfDay(range.end)
  if (!isValid(start) || !isValid(end) || end < start)
    return { granularity: "daily", points: [] }
  const count = differenceInCalendarDays(end, start) + 1
  const granularity: TrendGranularity =
    count <= 45 ? "daily" : count <= 180 ? "weekly" : "monthly"
  const bucketStart = (date: Date) =>
    granularity === "monthly"
      ? startOfMonth(date)
      : granularity === "weekly"
        ? startOfWeek(date, { locale })
        : startOfDay(date)
  const nextBucket = (date: Date) =>
    granularity === "monthly"
      ? addMonths(date, 1)
      : granularity === "weekly"
        ? addWeeks(date, 1)
        : addDays(date, 1)
  const keyOf = (date: Date) => format(date, "yyyy-MM-dd")
  const buckets = new Map<string, SpendingTrendPoint>()
  for (let cursor = bucketStart(start); cursor <= end; cursor = nextBucket(cursor)) {
    const first = cursor < start ? start : cursor
    const last = subDays(nextBucket(cursor), 1)
    const clippedLast = last > end ? end : last
    const date = keyOf(first)
    const endDate = keyOf(clippedLast)
    buckets.set(keyOf(cursor), {
      value: 0,
      date,
      endDate,
      label: format(first, granularity === "monthly" ? "MMM yy" : "d MMM", { locale }),
      periodLabel:
        date === endDate
          ? format(first, "PP", { locale })
          : `${format(first, "PP", { locale })} – ${format(clippedLast, "PP", { locale })}`,
    })
  }
  for (const expense of expenses) {
    const date = parseISO(expense.date)
    if (!isValid(date) || date < start || date > end) continue
    const bucket = buckets.get(keyOf(bucketStart(date)))
    if (bucket) bucket.value += Math.abs(expense.amount)
  }
  return { granularity, points: [...buckets.values()] }
}

/** Zero-based scale with four readable steps and headroom; never clip an outlier. */
export function getTrendScale(points: { value: number }[]) {
  const peak = points.reduce((max, point) => Math.max(max, point.value), 0)
  const rawStep = Math.max((peak * 1.1) / 4, 0.01)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const stepValue = Math.ceil(rawStep / magnitude) * magnitude
  return { stepValue, maxValue: stepValue * 4 }
}
