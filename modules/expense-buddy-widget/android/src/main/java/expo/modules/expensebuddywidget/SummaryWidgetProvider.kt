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
        val assist = assistFor(context)
        val copy = assist.toCopy()
        val views = RemoteViews(context.packageName, R.layout.expense_widget_summary)
        views.setOnClickPendingIntent(
            R.id.widget_root,
            WidgetIntents.openApp(context, "", widgetId),
        )
        views.setOnClickPendingIntent(
            R.id.widget_add,
            WidgetIntents.openApp(context, "add", widgetId + ADD_OFFSET),
        )

        when (
            val result =
                store(context).read(
                    filter = filter,
                    assistCurrency = assist?.currency,
                    assistVersion = assist?.dataVersion,
                )
        ) {
            is WidgetResult.Ready -> {
                val data = result.data
                val today = WidgetFormat.maskedAmount(data.todayTotal, data.currency, filter.hideAmounts)
                val month = WidgetFormat.maskedAmount(data.monthTotal, data.currency, filter.hideAmounts)
                views.setTextViewText(R.id.widget_label, copy.today)
                views.setTextViewText(R.id.widget_today_total, today)
                views.setTextViewText(
                    R.id.widget_subtitle,
                    "${copy.expensesToday(data.todayCount)} · ${copy.monthTotal(month)}",
                )
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Empty -> {
                val currency = displayCurrency(context)
                views.setTextViewText(R.id.widget_label, copy.today)
                views.setTextViewText(R.id.widget_today_total, WidgetFormat.amount(0.0, currency))
                views.setTextViewText(R.id.widget_subtitle, copy.empty)
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
