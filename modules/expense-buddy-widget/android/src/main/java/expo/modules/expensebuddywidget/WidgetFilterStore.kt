package expo.modules.expensebuddywidget

import android.content.Context

/**
 * Per-instance filter prefs. One file per placed widget (`expense_widget_<id>`),
 * never in a store. v1 fields: category + hideAmounts (ADR-012).
 */
internal class WidgetFilterStore(
    private val context: Context,
    private val widgetId: Int,
) {
    fun load(): WidgetFilter {
        val prefs =
            context.getSharedPreferences(
                "expense_widget_$widgetId",
                Context.MODE_PRIVATE,
            )
        return WidgetFilter(
            category = prefs.getString(KEY_CATEGORY, null),
            hideAmounts = prefs.getBoolean(KEY_HIDE_AMOUNTS, false),
        )
    }

    fun save(filter: WidgetFilter) {
        context
            .getSharedPreferences(
                "expense_widget_$widgetId",
                Context.MODE_PRIVATE,
            ).edit()
            .putString(KEY_CATEGORY, filter.category)
            .putBoolean(KEY_HIDE_AMOUNTS, filter.hideAmounts)
            .apply()
    }

    private companion object {
        const val KEY_CATEGORY = "category"
        const val KEY_HIDE_AMOUNTS = "hide_amounts"
    }
}
