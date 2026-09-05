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
        WidgetTheme.resolve(context).applyCard(
            context,
            views,
            R.id.widget_root,
            mutedTextIds = intArrayOf(R.id.widget_label, R.id.widget_empty),
        )
        views.setOnClickPendingIntent(
            R.id.widget_label,
            WidgetIntents.openApp(context, "history", widgetId),
        )

        val assist = assistFor(context)
        val copy = assist.toCopy(context)
        views.setTextViewText(R.id.widget_label, copy.recent)
        when (
            store(context).read(
                filter = WidgetFilterStore(context, widgetId).load(),
                assistCurrency = assist?.currency,
                assistVersion = assist?.dataVersion,
            )
        ) {
            is WidgetResult.Ready -> {
                views.setViewVisibility(R.id.widget_list, View.VISIBLE)
                views.setViewVisibility(R.id.widget_empty, View.GONE)
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
                views.setTextViewText(R.id.widget_empty, copy.empty)
                views.setViewVisibility(R.id.widget_list, View.GONE)
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
