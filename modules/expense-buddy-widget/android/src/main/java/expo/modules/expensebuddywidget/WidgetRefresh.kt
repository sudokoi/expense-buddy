package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * Refresh owner: broadcast-only, no stored scope. Providers do their own
 * goAsync + per-update scope (see ADR-012). Intents use string ComponentNames
 * (never Class.forName) so they survive release obfuscation.
 */
internal object WidgetRefresh {
    fun broadcastAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (provider in widgetProviders(context)) {
            val ids =
                try {
                    manager.getAppWidgetIds(provider)
                } catch (_: Exception) {
                    continue
                }
            if (ids.isEmpty()) continue
            val intent =
                Intent().setComponent(provider).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
            try {
                context.sendBroadcast(intent)
            } catch (_: Exception) {
                // Best-effort: next system update refreshes instead.
            }
        }
    }

    internal fun widgetProviders(context: Context): List<ComponentName> =
        listOf(
            "expo.modules.expensebuddywidget.SummaryWidgetProvider",
            "expo.modules.expensebuddywidget.TrendWidgetProvider",
            "expo.modules.expensebuddywidget.RecentWidgetProvider",
        ).map { ComponentName(context, it) }
}
