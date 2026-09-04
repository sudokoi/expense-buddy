package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * List adapter for the recent widget. Reads live rows per collection load
 * so rows never depend on a JS push; row taps fill in the history intent.
 */
class RecentWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = Factory(applicationContext, intent)

    private class Factory(
        private val context: Context,
        intent: Intent,
    ) : RemoteViewsFactory {
        private val widgetId: Int =
            intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID,
            )
        private var rows: List<WidgetExpense> = emptyList()
        private var currency: String = "INR"
        private var filter: WidgetFilter = WidgetFilter()
        private var colors: Map<String, String> = emptyMap()
        private var copy: WidgetCopy = WidgetCopy.fallback()

        override fun onCreate() {
            // No-op: data loads in onDataSetChanged per collection cycle.
        }

        override fun onDataSetChanged() {
            filter = WidgetFilterStore(context, widgetId).load()
            val mmkv = MmkvAndroidReader(context)
            val assist = WidgetAssistStore(context).load()
            val result =
                ExpenseWidgetStore(mmkv, SettingsAndroidReader(mmkv)).read(
                    filter = filter,
                    assistCurrency = assist?.currency,
                    assistVersion = assist?.dataVersion,
                )
            val ready = result as? WidgetResult.Ready
            if (ready == null) {
                rows = emptyList()
                return
            }
            rows = ready.data.recent
            currency = ready.data.currency
            colors = assist?.categoryColors ?: emptyMap()
            copy = assist.toCopy()
        }

        override fun getCount(): Int = rows.size

        override fun getViewAt(position: Int): RemoteViews? {
            if (position < 0 || position >= rows.size) return null
            val expense = rows[position]
            val views = RemoteViews(context.packageName, R.layout.expense_widget_recent_row)
            val title = expense.note.ifEmpty { copy.displayCategory(expense.category) }
            views.setTextViewText(R.id.row_title, title)
            views.setTextViewText(
                R.id.row_subtitle,
                "${copy.displayCategory(expense.category)} · ${expense.dayKey}",
            )
            val amount =
                WidgetFormat.maskedAmount(
                    expense.amount,
                    expense.currency ?: currency,
                    filter.hideAmounts,
                )
            views.setTextViewText(R.id.row_amount, amount)
            views.setInt(R.id.row_dot, "setColorFilter", dotColor(expense.category))
            views.setOnClickFillInIntent(R.id.row_root, Intent())
            return views
        }

        override fun getLoadingView(): RemoteViews? = null

        override fun getViewTypeCount(): Int = 1

        override fun getItemId(position: Int): Long =
            rows
                .getOrNull(position)
                ?.id
                .hashCode()
                ?.toLong() ?: position.toLong()

        override fun hasStableIds(): Boolean = true

        override fun onDestroy() {
            rows = emptyList()
        }

        private fun dotColor(category: String): Int =
            try {
                val hex = colors[category] ?: return context.getColor(R.color.expense_widget_accent)
                Color.parseColor(hex)
            } catch (_: Exception) {
                context.getColor(R.color.expense_widget_accent)
            }
    }
}
