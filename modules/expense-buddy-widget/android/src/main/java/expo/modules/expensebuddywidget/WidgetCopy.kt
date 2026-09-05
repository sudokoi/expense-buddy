package expo.modules.expensebuddywidget

import android.content.Context

/**
 * Widget display strings. The primary source is the app-persisted assist,
 * which carries copy captured from `translation.json` at compute time — this
 * class supplies Android-localized resource fallbacks when the assist is
 * missing/stale. `%d`/`%s` templates are formatted at render time.
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
    val configSubtitle: String,
    val configCategory: String,
    val configAll: String,
    val configHide: String,
    val configSave: String,
    val addExpense: String,
    private val trendDescriptionTemplate: String,
) {
    fun expensesToday(count: Int): String = if (count == 1) expensesOne else String.format(expensesManyTemplate, count)

    fun monthTotal(total: String): String = String.format(thisMonthTemplate, total)

    fun trendDescription(total: String): String = String.format(trendDescriptionTemplate, total)

    /** Canonical "Other" label never shows raw when a translation exists. */
    fun displayCategory(canonical: String): String = if (canonical == "Other") other else canonical

    companion object {
        fun fallback(context: Context): WidgetCopy =
            WidgetCopy(
                today = context.getString(R.string.expense_widget_today),
                last7Days = context.getString(R.string.expense_widget_last_7_days),
                recent = context.getString(R.string.expense_widget_recent),
                empty = context.getString(R.string.expense_widget_empty),
                expensesOne = context.getString(R.string.expense_widget_expenses_one),
                expensesManyTemplate = context.getString(R.string.expense_widget_expenses_many),
                thisMonthTemplate = context.getString(R.string.expense_widget_month_total),
                other = context.getString(R.string.expense_widget_other),
                configTitle = context.getString(R.string.expense_widget_config_title),
                configSubtitle = context.getString(R.string.expense_widget_config_subtitle),
                configCategory = context.getString(R.string.expense_widget_config_category),
                configAll = context.getString(R.string.expense_widget_config_all),
                configHide = context.getString(R.string.expense_widget_config_hide_amounts),
                configSave = context.getString(R.string.expense_widget_config_save),
                addExpense = context.getString(R.string.expense_widget_add_expense),
                trendDescriptionTemplate = context.getString(R.string.expense_widget_trend_total),
            )
    }
}

/** Single owner of the assist-or-fallback resolution used by every renderer. */
internal fun WidgetAssist?.toCopy(context: Context): WidgetCopy = this?.copy ?: WidgetCopy.fallback(context)
