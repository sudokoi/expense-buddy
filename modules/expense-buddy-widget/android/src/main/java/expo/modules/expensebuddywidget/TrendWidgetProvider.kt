package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.widget.RemoteViews

class TrendWidgetProvider : WidgetProviderBase() {
    override suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
    ) {
        val filter = WidgetFilterStore(context, widgetId).load()
        val views = RemoteViews(context.packageName, R.layout.expense_widget_trend)
        views.setOnClickPendingIntent(
            R.id.widget_root,
            WidgetIntents.openApp(context, "history", widgetId),
        )

        when (val result = store(context).read(filter = filter)) {
            is WidgetResult.Ready -> {
                val data = result.data
                val total =
                    if (filter.hideAmounts) {
                        WidgetFormat.HIDDEN
                    } else {
                        WidgetFormat.amount(data.last7Days.sumOf { it.total }, data.currency)
                    }
                views.setTextViewText(R.id.widget_total, total)
                views.setImageViewBitmap(
                    R.id.widget_chart,
                    TrendChartRenderer.render(context, data.last7Days),
                )
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Empty -> {
                views.setTextViewText(
                    R.id.widget_total,
                    WidgetFormat.amount(0.0, displayCurrency(context)),
                )
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Unavailable -> {
                // Leave existing content; storage may appear on next update.
            }
        }
    }
}
