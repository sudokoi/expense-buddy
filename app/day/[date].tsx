import { useLocalSearchParams, useRouter } from "expo-router"
import { YStack, Text, XStack, Button, H4 } from "tamagui"
import { useExpenses } from "../../stores/hooks"
import { useMemo, useCallback } from "react"
import { parseISO, format, isSameDay, addDays, subDays } from "date-fns"
import { ArrowLeft, ArrowRight, ChevronLeft } from "@tamagui/lucide-icons"
import { SectionList, ViewStyle, TextStyle } from "react-native"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import { Expense } from "../../types/expense"
import { Category } from "../../types/category"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import { useCategories, useSettings } from "../../stores/hooks"
import { formatCurrency } from "../../utils/currency"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { formatDate } from "../../utils/date"
import { useTranslation } from "react-i18next"

const layoutStyles = {
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
  } as ViewStyle,
  dateNav: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  } as ViewStyle,
  summary: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  listContent: {
    paddingBottom: 40,
  } as ViewStyle,
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  } as ViewStyle,
}

export default function DayViewScreen() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { state } = useExpenses()
  const { categories } = useCategories()
  const { settings } = useSettings()

  const targetDate = useMemo(() => (date ? parseISO(date) : new Date()), [date])
  const today = useMemo(() => new Date(), [])

  // Filter expenses for this day
  const dailyExpenses = useMemo(() => {
    return state.activeExpenses
      .filter((e) => isSameDay(parseISO(e.date), targetDate))
      .sort((a, b) => b.date.localeCompare(a.date)) // Sort time desc
  }, [state.activeExpenses, targetDate])

  // Group by category for display? Or just list?
  // Design: Just a simple list for the day view is fine, maybe grouped by hour if density is high,
  // but "Expenses for <Date>" suggests a single list.
  // We can reuse the SectionList structure if we want headers, or just FlatList.
  // Reusing SectionList with a single section for simplicity if we want to stick to patterns.
  // Actually, list is small enough, simple map or FlatList is fine.
  // Let's stick to SectionList for consistency with HistoryScreen if we want identical look.
  // But HistoryScreen groups by Day. Here we are IN a day.
  // So a FlatList is better.
  // But wait, user might want to edit/delete from here too?
  // Yes, reuse ExpenseRow logic.

  // NOTE: Day View currently is read-only in terms of editing/deleting?
  // The original prompt implies "DayView" in verification plan.
  // Let's add edit/delete support if easy, or just view.
  // HistoryScreen handles edit/delete.
  // We can pass `onEdit` `onDelete` if we want full fidelity.
  // For now, let's keep it simple: View only, maybe tap to edit later?
  // User didn't strictly ask for editing in DayView, but it's good UX.
  // Let's start with View.

  const totalSpent = useMemo(() => {
    return dailyExpenses.reduce((sum, e) => sum + e.amount, 0)
  }, [dailyExpenses])

  const categoryByLabel = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) {
      map.set(category.label, category)
    }
    return map
  }, [categories])

  const handlePrevDay = useCallback(() => {
    const prev = subDays(targetDate, 1)
    router.setParams({ date: prev.toISOString() })
  }, [targetDate, router])

  const handleNextDay = useCallback(() => {
    const next = addDays(targetDate, 1)
    router.setParams({ date: next.toISOString() })
  }, [targetDate, router])

  const dayTitle = useMemo(() => {
    if (isSameDay(targetDate, today)) return t("dayView.today")
    if (isSameDay(targetDate, addDays(today, 1))) return t("dayView.tomorrow")
    if (isSameDay(targetDate, subDays(today, 1))) return t("dayView.yesterday")
    return formatDate(targetDate.toISOString(), "EEEE") // e.g., "Monday"
  }, [targetDate, today, t])

  const fullDate = formatDate(targetDate.toISOString(), "MMMM d, yyyy")

  return (
    <YStack flex={1} bg="$background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <XStack style={layoutStyles.header}>
        <Button
          size="$3"
          chromeless
          icon={ChevronLeft}
          onPress={() => router.back()}
          color="$color"
        />
        <YStack alignItems="center">
          <Text fontSize="$5" fontWeight="bold">
            {dayTitle}
          </Text>
          <Text fontSize="$2" color="$color" opacity={0.6}>
            {fullDate}
          </Text>
        </YStack>
        <Button size="$3" chromeless icon={null} disabled />
      </XStack>

      {/* Date Nav */}
      <XStack style={layoutStyles.dateNav}>
        <Button size="$3" chromeless icon={ArrowLeft} onPress={handlePrevDay} />
        <Text fontSize="$6" fontWeight="bold" color="$color">
          {formatCurrency(totalSpent)}
        </Text>
        <Button size="$3" chromeless icon={ArrowRight} onPress={handleNextDay} />
      </XStack>

      <Text
        textAlign="center"
        fontSize="$2"
        color="$color"
        opacity={0.6}
        marginBottom="$4"
      >
        {t("dayView.totalSpent")}
      </Text>

      {/* Expenses List */}
      {dailyExpenses.length === 0 ? (
        <YStack style={layoutStyles.emptyContainer}>
          <Text color="$color" opacity={0.6}>
            {t("dayView.empty")}
          </Text>
        </YStack>
      ) : (
        <SectionList
          sections={[{ title: "Expenses", data: dailyExpenses }]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const categoryInfo =
              categoryByLabel.get(item.category) ??
              ({
                label: item.category,
                icon: "Circle",
                color: CATEGORY_COLORS.Other,
              } satisfies Pick<Category, "label" | "icon" | "color">)

            return (
              <ExpenseRow
                expense={item}
                categoryInfo={categoryInfo}
                subtitleMode="time"
                instruments={settings.paymentInstruments ?? []}
                showActions={false}
              />
            )
          }}
          contentContainerStyle={layoutStyles.listContent}
        />
      )}
    </YStack>
  )
}
