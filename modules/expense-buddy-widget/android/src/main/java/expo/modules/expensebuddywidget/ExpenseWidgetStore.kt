package expo.modules.expensebuddywidget

import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Deep module behind `fun read`. Owns MMKV parsing, day-key parity,
 * currency fallback, and aggregation. Providers stay thin adapters.
 */
class ExpenseWidgetStore(
    private val mmkv: MmkvReader,
    private val settings: SettingsReader,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    fun read(
        now: LocalDate = LocalDate.now(zone),
        filter: WidgetFilter = WidgetFilter(),
        recentLimit: Int = 8,
    ): WidgetResult {
        val indexRaw = mmkv.getString(WidgetKeys.EXPENSES_INDEX) ?: return WidgetResult.Unavailable
        val ids = parseIndex(indexRaw)
        if (ids.isEmpty()) return WidgetResult.Empty

        val rows = parseItems(ids)
        if (rows.isEmpty()) return WidgetResult.Empty

        val filtered =
            when (filter.category) {
                null -> rows
                else -> rows.filter { it.category == filter.category }
            }
        if (filtered.isEmpty()) return WidgetResult.Empty

        val defaultCurrency = settings.defaultCurrency()
        val currency = filtered.firstNotNullOfOrNull { it.currency } ?: defaultCurrency

        val todayKey = formatDay(now)
        val monthPrefix = todayKey.substring(0, 7)
        val todayRows = filtered.filter { it.dayKey == todayKey }
        val monthRows = filtered.filter { it.dayKey.startsWith(monthPrefix) }

        val last7Days =
            (6 downTo 0).map { offset ->
                val day = now.minusDays(offset.toLong())
                val key = formatDay(day)
                DayTotal(key, filtered.filter { it.dayKey == key }.sumOf { it.amount })
            }
        val recent = filtered.take(recentLimit)
        val dataVersion = filtered.maxOf { it.updatedAt }

        return WidgetResult.Ready(
            WidgetData(
                currency = currency,
                todayTotal = todayRows.sumOf { it.amount },
                todayCount = todayRows.size,
                monthTotal = monthRows.sumOf { it.amount },
                last7Days = last7Days,
                recent = recent,
                dataVersion = dataVersion,
            ),
        )
    }

    private fun parseIndex(raw: String): List<String> =
        try {
            val arr = org.json.JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val v = arr.optString(i, "")
                    if (v.isNotEmpty()) add(v)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }

    private fun parseItems(ids: List<String>): List<WidgetExpense> {
        val keys = ids.map { WidgetKeys.itemKey(it) }
        return mmkv.multiGet(keys).mapNotNull { (_, raw) ->
            if (raw == null) return@mapNotNull null
            parseExpense(raw)
        }
    }

    internal fun parseExpense(raw: String): WidgetExpense? {
        try {
            val o = JSONObject(raw)
            if (!o.isNull("deletedAt")) return null
            val id = o.optString("id", "")
            if (id.isEmpty()) return null
            val amount = kotlin.math.abs(o.optDouble("amount", Double.NaN))
            if (amount.isNaN()) return null
            val dayKey = toDayKey(o.optString("date", "")) ?: return null
            return WidgetExpense(
                id = id,
                amount = amount,
                currency = o.optString("currency", "").ifEmpty { null },
                category = o.optString("category", "Other").ifEmpty { "Other" },
                note = o.optString("note", ""),
                dayKey = dayKey,
                updatedAt = o.optString("updatedAt", ""),
            )
        } catch (_: Exception) {
            return null
        }
    }

    /** Parity with `getLocalDayKey`: parse instant, render in device zone. */
    internal fun toDayKey(iso: String): String? {
        try {
            if (iso.isEmpty()) return null
            return formatDay(Instant.parse(iso).atZone(zone).toLocalDate())
        } catch (_: Exception) {
            return null
        }
    }

    private fun formatDay(day: LocalDate): String = day.format(DateTimeFormatter.ISO_LOCAL_DATE)
}
