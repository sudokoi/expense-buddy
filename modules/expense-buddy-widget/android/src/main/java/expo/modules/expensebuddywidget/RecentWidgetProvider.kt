package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/** Shell only: the collection factory alone owns the live ledger read and empty state. */
class RecentWidgetProvider : WidgetProviderBase() {
    internal override val kind = WidgetKind.RECENT

    override suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        snapshot: () -> ExpenseWidgetStore.Snapshot,
    ) {
        val views = RemoteViews(context.packageName, R.layout.expense_widget_recent)
        WidgetTheme
            .resolve(
                context,
            ).applyCard(context, views, R.id.widget_root, mutedTextIds = intArrayOf(R.id.widget_label, R.id.widget_empty))
        val copy = assistFor(context).toCopy(context)
        views.setTextViewText(R.id.widget_label, copy.recent)
        views.setTextViewText(R.id.widget_empty, copy.empty)
        views.setOnClickPendingIntent(R.id.widget_label, WidgetIntents.openApp(context, "history", widgetId))
        val service =
            Intent(context, RecentWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = android.net.Uri.parse("expense-widget://recent/$widgetId")
            }
        views.setRemoteAdapter(R.id.widget_list, service)
        views.setEmptyView(R.id.widget_list, R.id.widget_empty)
        views.setPendingIntentTemplate(R.id.widget_list, WidgetIntents.openApp(context, "history", widgetId + ROW_OFFSET))
        manager.updateAppWidget(widgetId, views)
        manager.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
    }

    private companion object {
        const val ROW_OFFSET = 2_000_000
    }
}
