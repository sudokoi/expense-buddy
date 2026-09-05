package expo.modules.expensebuddywidget

import java.time.LocalDate

/** Refresh-local projections. Reading one widget's data never computes the others. */
class WidgetData internal constructor(
    val currency: String,
    private val rows: List<WidgetExpense>,
    private val now: LocalDate,
    private val recentLimit: Int,
    val dataVersion: String,
) {
    private data class Summary(
        val todayTotal: Double,
        val todayCount: Int,
        val monthTotal: Double,
    )

    private val summary by lazy {
        val today = now.toString()
        val month = today.substring(0, 7)
        var todayTotal = 0.0
        var todayCount = 0
        var monthTotal = 0.0
        for (row in rows) {
            if (row.dayKey == today) {
                todayTotal += row.amount
                todayCount++
            }
            if (row.dayKey.startsWith(month)) monthTotal += row.amount
        }
        Summary(todayTotal, todayCount, monthTotal)
    }
    val todayTotal: Double get() = summary.todayTotal
    val todayCount: Int get() = summary.todayCount
    val monthTotal: Double get() = summary.monthTotal

    val last7Days: List<DayTotal> by lazy {
        val days = (6 downTo 0).associate { now.minusDays(it.toLong()).toString() to sortedMapOf<String, Double>() }
        for (row in rows) {
            days[row.dayKey]?.let { totals -> totals[row.category] = (totals[row.category] ?: 0.0) + row.amount }
        }
        days.map { (day, totals) -> DayTotal(day, totals.values.sum(), totals.map { CategoryTotal(it.key, it.value) }) }
    }

    val recent: List<WidgetExpense> by lazy {
        if (recentLimit <= 0) return@lazy emptyList()
        val newestFirst = compareByDescending<WidgetExpense> { it.dayKey }.thenByDescending { it.updatedAt }
        val selected = mutableListOf<WidgetExpense>()
        for (row in rows) {
            // Insert after ties so equal timestamps retain the ledger's stable order.
            val index = selected.indexOfFirst { newestFirst.compare(row, it) < 0 }.let { if (it < 0) selected.size else it }
            if (index < recentLimit) {
                selected.add(index, row)
                if (selected.size > recentLimit) selected.removeAt(selected.lastIndex)
            }
        }
        selected
    }
}
