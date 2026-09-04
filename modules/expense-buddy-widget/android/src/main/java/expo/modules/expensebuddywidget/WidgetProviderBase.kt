package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Shared update plumbing. No stored scope: each `onUpdate` owns a
 * per-call scope tied to `goAsync`, so a dead provider never leaks work.
 * Subclasses implement [render] (suspend, IO) per WidgetKind.
 */
abstract class WidgetProviderBase : AppWidgetProvider() {
    override fun onEnabled(context: Context) {
        // Idempotent: first placed widget arms the 30-min backstop.
        try {
            WidgetRefreshSchedule.ensure(context)
        } catch (_: Exception) {
            // Best-effort: system updates still refresh without the worker.
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                for (widgetId in appWidgetIds) {
                    render(context, appWidgetManager, widgetId)
                }
            } catch (_: Exception) {
                // Best-effort: leave existing widget content on failure.
            } finally {
                pending.finish()
            }
        }
    }

    protected abstract suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
    )

    protected fun store(context: Context): ExpenseWidgetStore {
        val app = context.applicationContext
        val mmkv = MmkvAndroidReader(app)
        return ExpenseWidgetStore(mmkv, SettingsAndroidReader(mmkv))
    }
}
