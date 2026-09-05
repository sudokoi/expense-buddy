import { addDays, format, parseISO } from "date-fns"
import { enGB, enUS, ja } from "date-fns/locale"
import { aggregateSpendingTrend, getTrendScale } from "./spending-trend"
import type { Locale } from "date-fns"

function buildSpendingTrend(data: { date: string; value: number }[], locale: Locale) {
  return aggregateSpendingTrend(
    data.map((item) => ({ date: item.date, amount: item.value })),
    {
      start: parseISO(data[0]?.date ?? "invalid"),
      end: parseISO(data.at(-1)?.date ?? "invalid"),
    },
    locale
  )
}

function dailySeries(start: string, count: number, value = 10) {
  return Array.from({ length: count }, (_, index) => ({
    date: format(addDays(parseISO(start), index), "yyyy-MM-dd"),
    value,
    label: "",
  }))
}

describe("buildSpendingTrend", () => {
  it("buckets sparse raw expenses directly while preserving zero months and clipped edges", () => {
    const result = aggregateSpendingTrend(
      [
        { date: "2016-01-17T12:00:00", amount: -10 },
        { date: "2026-01-17T12:00:00", amount: 20 },
        { date: "2016-01-16T12:00:00", amount: 999 },
        { date: "2026-01-18T00:00:00", amount: 999 },
        { date: "invalid", amount: 999 },
      ],
      { start: parseISO("2016-01-17"), end: parseISO("2026-01-17") },
      enGB
    )
    expect(result.points).toHaveLength(121)
    expect(result.points[0]).toMatchObject({
      date: "2016-01-17",
      endDate: "2016-01-31",
      value: 10,
    })
    expect(result.points.at(-1)).toMatchObject({
      date: "2026-01-01",
      endDate: "2026-01-17",
      value: 20,
    })
    expect(result.points.reduce((sum, point) => sum + point.value, 0)).toBe(30)
    expect(result.points.filter((point) => point.value === 0)).toHaveLength(119)
  })

  it("handles empty and single-day periods", () => {
    expect(buildSpendingTrend([], enGB)).toEqual({ granularity: "daily", points: [] })
    const { points } = buildSpendingTrend(dailySeries("2026-09-05", 1, 0), enGB)
    expect(points[0]).toMatchObject({
      value: 0,
      date: "2026-09-05",
      endDate: "2026-09-05",
      periodLabel: "5 Sep 2026",
    })
  })

  it.each([
    [45, "daily"],
    [46, "weekly"],
    [180, "weekly"],
    [181, "monthly"],
  ])("uses appropriate detail for %i days", (count, granularity) => {
    const data = dailySeries("2026-01-01", count as number)
    const result = buildSpendingTrend(data, enGB)
    expect(result.granularity).toBe(granularity)
    expect(result.points.reduce((total, point) => total + point.value, 0)).toBe(
      data.length * 10
    )
  })

  it("respects locale week boundaries and labels partial weeks accurately", () => {
    const data = dailySeries("2026-09-05", 46)
    expect(buildSpendingTrend(data, enGB).points[0]).toMatchObject({
      date: "2026-09-05",
      endDate: "2026-09-06",
      value: 20,
    })
    expect(buildSpendingTrend(data, enUS).points[0]).toMatchObject({
      date: "2026-09-05",
      endDate: "2026-09-05",
      value: 10,
    })
  })

  it("retains zero-spend months, leap days, and distinct years", () => {
    const data = dailySeries("2024-01-15", 400, 0)
    data.find((point) => point.date === "2024-02-29")!.value = 125.75
    data.at(-1)!.value = 20.25
    const { points } = buildSpendingTrend(data, enGB)
    expect(points).toHaveLength(14)
    expect(points[0]).toMatchObject({ date: "2024-01-15", value: 0, label: "Jan 24" })
    expect(points[1]).toMatchObject({ endDate: "2024-02-29", value: 125.75 })
    expect(points.at(-1)).toMatchObject({ endDate: data.at(-1)!.date, value: 20.25 })
    expect(points.reduce((total, point) => total + point.value, 0)).toBe(146)
  })

  it("localizes dates and does not mutate the source series", () => {
    const data = dailySeries("2026-09-05", 1)
    const original = structuredClone(data)
    const { points } = buildSpendingTrend(data, ja)
    expect(points[0].periodLabel).toBe("2026/09/05")
    expect(data).toEqual(original)
  })
})

describe("getTrendScale", () => {
  it.each([0, 0.01, 0.5, 1, 27_493, 114_906, 1_000_000_000])(
    "keeps %s visible with four finite, positive steps",
    (peak) => {
      const scale = getTrendScale([{ value: peak }, { value: 0 }])
      expect(Number.isFinite(scale.maxValue)).toBe(true)
      expect(scale.stepValue).toBeGreaterThan(0)
      expect(scale.maxValue).toBeGreaterThan(peak)
      expect(scale.maxValue).toBe(scale.stepValue * 4)
    }
  )

  it("handles no points", () => {
    expect(getTrendScale([])).toEqual({ stepValue: 0.01, maxValue: 0.04 })
  })
})
