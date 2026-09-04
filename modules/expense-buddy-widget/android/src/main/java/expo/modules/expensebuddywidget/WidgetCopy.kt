package expo.modules.expensebuddywidget

/**
 * Widget display strings. The primary source is the app-persisted assist,
 * which carries copy captured from `translation.json` at compute time — this
 * class only supplies the degraded English fallback for the path where the
 * assist is missing/stale. `%d`/`%s` templates are formatted at render time.
 */
class WidgetCopy internal constructor(
    val today: String,
    val last7Days: String,
    val recent: String,
    val empty: String,
    private val expensesOne: String,
    private val expensesManyTemplate: String,
    private val thisMonthTemplate: String,
    private val other: String,
    val configTitle: String,
    val configCategory: String,
    val configAll: String,
    val configHide: String,
    val configSave: String,
) {
    fun expensesToday(count: Int): String = if (count == 1) expensesOne else String.format(expensesManyTemplate, count)

    fun monthTotal(total: String): String = String.format(thisMonthTemplate, total)

    /** Canonical "Other" label never shows raw when a translation exists. */
    fun displayCategory(canonical: String): String = if (canonical == "Other") other else canonical

    companion object {
        fun fallback(): WidgetCopy =
            WidgetCopy(
                today = "Today",
                last7Days = "Last 7 days",
                recent = "Recent expenses",
                empty = "No expenses yet",
                expensesOne = "1 expense today",
                expensesManyTemplate = "%d expenses today",
                thisMonthTemplate = "%s this month",
                other = "Other",
                configTitle = "Widget settings",
                configCategory = "Category",
                configAll = "All categories",
                configHide = "Hide amounts",
                configSave = "Add widget",
            )
    }
}

/** Single owner of the assist-or-fallback resolution used by every renderer. */
internal fun WidgetAssist?.toCopy(): WidgetCopy = this?.copy ?: WidgetCopy.fallback()
