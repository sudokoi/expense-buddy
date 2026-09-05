package expo.modules.expensebuddywidget

import org.json.JSONObject

/** Per-instance filter. v1: category + hideAmounts only (ADR-012). */
data class WidgetFilter(
    val category: String? = null,
    val hideAmounts: Boolean = false,
)

/** Minimal expense row needed by the widget. Amounts use abs() like TS. */
data class WidgetExpense(
    val id: String,
    val amount: Double,
    val currency: String?,
    val category: String,
    val note: String,
    /** Device-local day key yyyy-MM-dd, ZoneId.systemDefault parity with getLocalDayKey. */
    val dayKey: String,
    val updatedAt: String,
)

data class DayTotal(
    val dayKey: String,
    val total: Double,
)

data class WidgetData(
    val currency: String,
    val todayTotal: Double,
    val todayCount: Int,
    val monthTotal: Double,
    val last7Days: List<DayTotal>,
    val recent: List<WidgetExpense>,
    /** max(updatedAt) over live rows; compared against assist dataVersion. */
    val dataVersion: String,
)

/** Closed render outcome — callers use exhaustive `when`, no `else`. */
sealed interface WidgetResult {
    data class Ready(
        val data: WidgetData,
    ) : WidgetResult

    data object Empty : WidgetResult

    data object Unavailable : WidgetResult
}

/** JS-written hints only. Numbers are never trusted when stale (ADR-012). */
data class WidgetAssist(
    val dataVersion: String,
    val currency: String,
    val locale: String? = null,
    val categoryColors: Map<String, String> = emptyMap(),
    /** Localized display strings captured by the app; null in old snapshots. */
    val copy: WidgetCopy? = null,
) {
    companion object {
        fun fromJson(json: String): WidgetAssist? =
            try {
                val o = JSONObject(json)
                val colors = mutableMapOf<String, String>()
                val raw = o.optJSONObject("categoryColors")
                if (raw != null) {
                    val keys = raw.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        colors[k] = raw.optString(k)
                    }
                }
                WidgetAssist(
                    dataVersion = o.optString("dataVersion"),
                    currency = o.optString("currency", "INR").ifEmpty { "INR" },
                    locale = o.optString("locale", "").ifEmpty { null },
                    categoryColors = colors,
                    copy = readCopy(o.optJSONObject("copy")),
                )
            } catch (_: Exception) {
                null
            }

        private fun readCopy(o: JSONObject?): WidgetCopy? {
            if (o == null) return null
            return try {
                // Strict: every field must parse. Old snapshots missing newer
                // fields (e.g. written before an app update added them) fall
                // back to English wholesale instead of rendering a mix of
                // stale strings and raw keys. The next assist push heals it.
                WidgetCopy(
                    today = o.getString("today"),
                    last7Days = o.getString("last7Days"),
                    recent = o.getString("recent"),
                    empty = o.getString("empty"),
                    expensesOne = o.getString("expensesOne"),
                    expensesManyTemplate = o.getString("expensesMany"),
                    thisMonthTemplate = o.getString("thisMonth"),
                    other = o.getString("other"),
                    configTitle = o.getString("configTitle"),
                    configSubtitle = o.getString("configSubtitle"),
                    configCategory = o.getString("configCategory"),
                    configAll = o.getString("configAll"),
                    configHide = o.getString("configHide"),
                    configSave = o.getString("configSave"),
                    addExpense = o.getString("addExpense"),
                    trendDescriptionTemplate = o.getString("trendDescription"),
                )
            } catch (_: Exception) {
                null
            }
        }
    }
}
