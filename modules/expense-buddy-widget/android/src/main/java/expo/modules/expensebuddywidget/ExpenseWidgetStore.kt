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
    /**
     * @param assistCurrency effective currency hint from JS. Trusted only
     * when [assistVersion] matches the live rows (staleness rule, ADR-012).
     */
    fun read(
        now: LocalDate = LocalDate.now(zone),
        filter: WidgetFilter = WidgetFilter(),
        recentLimit: Int = 8,
        assistCurrency: String? = null,
        assistVersion: String? = null,
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
        val liveVersion = filtered.maxOf { it.updatedAt }
        // Mirror TS currency grouping: totals cover one currency group, never
        // a mixed sum. Assist wins only when fresh; otherwise the default;
        // when neither group exists, fall back to the most recent row.
        val freshAssist =
            !assistCurrency.isNullOrEmpty() &&
                !assistVersion.isNullOrEmpty() &&
                assistVersion == liveVersion
        val candidates =
            listOfNotNull(
                assistCurrency.takeIf { freshAssist },
                defaultCurrency,
            )
        val rowCurrency = { row: WidgetExpense -> row.currency ?: defaultCurrency }
        val target =
            candidates.firstOrNull { code -> filtered.any { rowCurrency(it) == code } }
                ?: filtered
                    .maxWithOrNull(
                        compareBy<WidgetExpense> { it.dayKey }.thenBy { it.updatedAt },
                    )?.let { rowCurrency(it) }
                ?: defaultCurrency
        val grouped = filtered.filter { rowCurrency(it) == target }
        if (grouped.isEmpty()) return WidgetResult.Empty

        val todayKey = formatDay(now)
        val monthPrefix = todayKey.substring(0, 7)
        val todayRows = grouped.filter { it.dayKey == todayKey }
        val monthRows = grouped.filter { it.dayKey.startsWith(monthPrefix) }

        val last7Days =
            (6 downTo 0).map { offset ->
                val day = now.minusDays(offset.toLong())
                val key = formatDay(day)
                val dayRows = grouped.filter { it.dayKey == key }
                val categories =
                    dayRows
                        .groupBy { it.category }
                        .map { (category, rows) -> CategoryTotal(category, rows.sumOf { it.amount }) }
                        .sortedBy { it.category }
                DayTotal(key, dayRows.sumOf { it.amount }, categories)
            }
        val recent =
            grouped
                .sortedWith(
                    compareByDescending<WidgetExpense> { it.dayKey }
                        .thenByDescending { it.updatedAt },
                ).take(recentLimit)

        return WidgetResult.Ready(
            WidgetData(
                currency = target,
                todayTotal = todayRows.sumOf { it.amount },
                todayCount = todayRows.size,
                monthTotal = monthRows.sumOf { it.amount },
                last7Days = last7Days,
                recent = recent,
                dataVersion = liveVersion,
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
