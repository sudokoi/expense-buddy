package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * Refresh owner: broadcast-only, no stored scope. Providers do their own
 * goAsync + per-update scope (see ADR-012). Actual provider classes land
 * in the next step; this broadcasts to any that exist so the bridge is
 * usable before layouts land.
 */
internal object WidgetRefresh {
    fun broadcastAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (provider in transactionProviders(context)) {
            val ids = manager.getAppWidgetIds(provider)
            if (ids.isEmpty()) continue
            val intent =
                Intent(context, Class.forName(provider.className)).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
            context.sendBroadcast(intent)
        }
    }

    private fun transactionProviders(context: Context): List<ComponentName> =
        listOf(
            "expo.modules.expensebuddywidget.SummaryWidgetProvider",
            "expo.modules.expensebuddywidget.TrendWidgetProvider",
            "expo.modules.expensebuddywidget.RecentWidgetProvider",
        ).map { ComponentName(context, it) }
}
