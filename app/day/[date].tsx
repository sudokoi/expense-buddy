import { useLocalSearchParams, useRouter, Stack } from "expo-router"
import { YStack, Text, XStack, Button } from "tamagui"
import { useExpenses } from "../../stores/hooks"
import { useMemo, useCallback } from "react"
import { parseISO, isSameDay, addDays, subDays } from "date-fns"
import { ArrowLeft, ArrowRight, ChevronLeft } from "@tamagui/lucide-icons-2"
import { FlashList } from "@shopify/flash-list"
import { ExpenseRow } from "../../components/ui/ExpenseRow"
import type { Expense } from "../../types/expense"
import { Category } from "../../types/category"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import { useCategories, useSettings } from "../../stores/hooks"
import { formatCurrency } from "../../utils/currency"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { formatDate } from "../../utils/date"
import { useTranslation } from "react-i18next"
import {
  UI_SPACE,
  UI_OPACITY,
  UI_FONT_WEIGHT,
  UI_ICON_SIZE,
} from "../../constants/ui-tokens"
import { IconActionButton } from "../../components/ui/IconActionButton"

const FALLBACK_CATEGORY_CACHE = new Map<
  string,
  Pick<Category, "label" | "icon" | "color">
>()

function getFallbackCategory(label: string): Pick<Category, "label" | "icon" | "color"> {
  let info = FALLBACK_CATEGORY_CACHE.get(label)
  if (!info) {
    info = { label, icon: "Circle", color: CATEGORY_COLORS.Other }
    FALLBACK_CATEGORY_CACHE.set(label, info)
  }
  return info
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

  // A single day's expenses render as one flat list (History groups by day,
  // but here we're already inside one), so a FlashList is lighter than the
  // SectionList used by History's grouped view.

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

  const keyExtractor = useCallback((item: Expense) => item.id, [])

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => {
      const categoryInfo =
        categoryByLabel.get(item.category) ?? getFallbackCategory(item.category)

      return (
        <ExpenseRow
          expense={item}
          categoryInfo={categoryInfo}
          subtitleMode="time"
          instruments={settings.paymentInstruments ?? []}
          showActions={false}
        />
      )
    },
    [categoryByLabel, settings.paymentInstruments]
  )

  return (
    <YStack flex={1} bg="$background" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <XStack
        px={UI_SPACE.gutter}
        pt={UI_SPACE.gutter}
        pb={UI_SPACE.control}
        items="center"
        justify="center"
      >
        <IconActionButton
          icon={<ChevronLeft size={UI_ICON_SIZE.medium} />}
          onPress={() => router.back()}
          tooltip={t("common.back")}
          accessibilityLabel={t("common.back")}
        />
        <YStack style={{ alignItems: "center" }}>
          <Text fontSize="$title" fontWeight={UI_FONT_WEIGHT.bold}>
            {dayTitle}
          </Text>
          <Text fontSize="$caption" color="$color" opacity={UI_OPACITY.subtle}>
            {fullDate}
          </Text>
        </YStack>
        <Button size="$compact" chromeless icon={null} disabled />
      </XStack>

      {/* Date Nav */}
      <XStack
        items="center"
        justify="space-between"
        px={UI_SPACE.gutter}
        pb={UI_SPACE.control}
      >
        <IconActionButton
          icon={<ArrowLeft size={UI_ICON_SIZE.medium} />}
          onPress={handlePrevDay}
          tooltip={t("dayView.previousDay")}
          accessibilityLabel={t("dayView.previousDay")}
        />
        <Text fontSize="$sectionTitle" fontWeight={UI_FONT_WEIGHT.bold} color="$color">
          {formatCurrency(totalSpent)}
        </Text>
        <IconActionButton
          icon={<ArrowRight size={UI_ICON_SIZE.medium} />}
          onPress={handleNextDay}
          tooltip={t("dayView.nextDay")}
          accessibilityLabel={t("dayView.nextDay")}
        />
      </XStack>

      <Text
        style={{ textAlign: "center", marginBottom: UI_SPACE.gutter }}
        fontSize="$caption"
        color="$color"
        opacity={UI_OPACITY.subtle}
      >
        {t("dayView.totalSpent")}
      </Text>

      {/* Expenses List */}
      {dailyExpenses.length === 0 ? (
        <YStack flex={1} items="center" justify="center" p={UI_SPACE.gutter}>
          <Text color="$color" opacity={UI_OPACITY.subtle}>
            {t("dayView.empty")}
          </Text>
        </YStack>
      ) : (
        <FlashList
          data={dailyExpenses}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: UI_SPACE.gutter }}
        />
      )}
    </YStack>
  )
}
