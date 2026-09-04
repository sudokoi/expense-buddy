package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews

class SummaryWidgetProvider : WidgetProviderBase() {
    override suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
    ) {
        val filter = WidgetFilterStore(context, widgetId).load()
        val views = RemoteViews(context.packageName, R.layout.expense_widget_summary)
        views.setOnClickPendingIntent(
            R.id.widget_root,
            WidgetIntents.openApp(context, "", widgetId),
        )
        views.setOnClickPendingIntent(
            R.id.widget_add,
            WidgetIntents.openApp(context, "add", widgetId + ADD_OFFSET),
        )

        when (val result = store(context).read(filter = filter)) {
            is WidgetResult.Ready -> {
                val data = result.data
                val today =
                    if (filter.hideAmounts) {
                        WidgetFormat.HIDDEN
                    } else {
                        WidgetFormat.amount(data.todayTotal, data.currency)
                    }
                val month =
                    if (filter.hideAmounts) {
                        WidgetFormat.HIDDEN
                    } else {
                        WidgetFormat.amount(data.monthTotal, data.currency)
                    }
                views.setTextViewText(R.id.widget_today_total, today)
                val count =
                    if (data.todayCount == 1) "1 expense today" else "${data.todayCount} expenses today"
                views.setTextViewText(R.id.widget_subtitle, "$count · $month this month")
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Empty -> {
                val currency = displayCurrency(context)
                views.setTextViewText(R.id.widget_today_total, WidgetFormat.amount(0.0, currency))
                views.setTextViewText(R.id.widget_subtitle, "No expenses yet")
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Unavailable -> {
                // Leave existing content; storage may appear on next update.
            }
        }
    }

    private companion object {
        const val ADD_OFFSET = 1_000_000
    }
}
