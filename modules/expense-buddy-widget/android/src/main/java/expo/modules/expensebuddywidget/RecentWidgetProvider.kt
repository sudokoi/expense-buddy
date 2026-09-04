package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

class RecentWidgetProvider : WidgetProviderBase() {
    override suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
    ) {
        val views = RemoteViews(context.packageName, R.layout.expense_widget_recent)
        views.setOnClickPendingIntent(
            R.id.widget_label,
            WidgetIntents.openApp(context, "history", widgetId),
        )

        val assist = assistFor(context)
        when (
            store(context).read(
                filter = WidgetFilterStore(context, widgetId).load(),
                assistCurrency = assist?.currency,
                assistVersion = assist?.dataVersion,
            )
        ) {
            is WidgetResult.Ready -> {
                val service =
                    Intent(context, RecentWidgetService::class.java).apply {
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                        // Unique URI so extras are not dropped by intent caching.
                        data = android.net.Uri.parse("expense-widget://recent/$widgetId")
                    }
                views.setRemoteAdapter(R.id.widget_list, service)
                views.setEmptyView(R.id.widget_list, R.id.widget_empty)
                views.setPendingIntentTemplate(
                    R.id.widget_list,
                    WidgetIntents.openApp(context, "history", widgetId + ROW_OFFSET),
                )
                manager.updateAppWidget(widgetId, views)
                manager.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
            }
            WidgetResult.Empty -> {
                views.setTextViewText(R.id.widget_empty, "No expenses yet")
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                manager.updateAppWidget(widgetId, views)
            }
            WidgetResult.Unavailable -> {
                // Leave existing content; storage may appear on next update.
            }
        }
    }

    private companion object {
        const val ROW_OFFSET = 2_000_000
    }
}
