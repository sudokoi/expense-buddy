/**
 * ImportHistoryView
 *
 * Displays a filterable list of auto-imported expenses.
 * Supports filtering by status: All, Confirmed, Edited, Rejected.
 */

import { useState, useMemo, useCallback } from "react"
import { FlatList, ListRenderItem, ViewStyle } from "react-native"
import { YStack, XStack, Text, Button, Separator } from "tamagui"
import { useTranslation } from "react-i18next"
import { Expense } from "../../../types/expense"
import { useExpenses } from "../../../stores/hooks"
import { getCurrencySymbol, getFallbackCurrency } from "../../../utils/currency"
import {
  type ImportFilter,
  IMPORT_FILTERS,
  formatImportDate,
  getImportStatus,
  matchesFilter,
} from "./import-history-utils"

export { type ImportFilter, formatImportDate, getImportStatus, matchesFilter }

const layoutStyles = {
  filterRow: { flexWrap: "wrap", gap: 8 } as ViewStyle,
  itemRow: { justifyContent: "space-between", alignItems: "center" } as ViewStyle,
}

export function ImportHistoryView() {
  const { t } = useTranslation()
  const {
    state: { activeExpenses },
  } = useExpenses()
  const [filter, setFilter] = useState<ImportFilter>("all")

  const autoImportedExpenses = useMemo(
    () => activeExpenses.filter((e) => e.source === "auto-imported"),
    [activeExpenses]
  )

  const filteredExpenses = useMemo(
    () => autoImportedExpenses.filter((e) => matchesFilter(e, filter)),
    [autoImportedExpenses, filter]
  )

  const handleFilterPress = useCallback((f: ImportFilter) => {
    setFilter(f)
  }, [])

  const keyExtractor = useCallback((item: Expense) => item.id, [])

  const renderItem: ListRenderItem<Expense> = useCallback(
    ({ item }) => {
      const symbol = getCurrencySymbol(item.currency || getFallbackCurrency())
      const status = getImportStatus(item)
      const statusKey = `smsImport.importHistory.status.${status}` as const

      return (
        <YStack p="$3" gap="$1" borderBottomWidth={1} borderColor="$borderColor">
          <XStack style={layoutStyles.itemRow}>
            <Text fontSize="$4" fontWeight="600" color="$color">
              {item.note || t("smsImport.importHistory.unknownMerchant")}
            </Text>
            <Text fontSize="$4" fontWeight="bold" color="$color">
              {symbol}
              {item.amount.toFixed(2)}
            </Text>
          </XStack>
          <XStack style={layoutStyles.itemRow}>
            <Text fontSize="$2" color="$color" opacity={0.6}>
              {formatImportDate(item)}
            </Text>
            <Text
              fontSize="$2"
              color={status === "edited" ? "$yellow10" : "$green10"}
              fontWeight="500"
            >
              {t(statusKey)}
            </Text>
          </XStack>
        </YStack>
      )
    },
    [t]
  )

  const listHeader = useMemo(
    () => (
      <YStack gap="$3" p="$3">
        <Text fontSize="$5" fontWeight="700" color="$color">
          {t("smsImport.importHistory.title")}
        </Text>
        <XStack style={layoutStyles.filterRow}>
          {IMPORT_FILTERS.map((f) => (
            <Button
              key={f}
              size="$3"
              onPress={() => handleFilterPress(f)}
              themeInverse={filter === f}
              bordered={filter !== f}
              rounded="$6"
            >
              {t(`smsImport.importHistory.filters.${f}`)}
            </Button>
          ))}
        </XStack>
        <Separator />
      </YStack>
    ),
    [t, filter, handleFilterPress]
  )

  const listEmpty = useMemo(
    () => (
      <YStack p="$6" items="center" gap="$2">
        <Text fontSize="$4" color="$color" opacity={0.5}>
          {t("smsImport.importHistory.empty")}
        </Text>
      </YStack>
    ),
    [t]
  )

  return (
    <YStack flex={1} bg="$background">
      <FlatList
        data={filteredExpenses}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
      />
    </YStack>
  )
}
