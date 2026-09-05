package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/**
 * Each broadcast owns a bounded waiter; the process renderer coalesces actual work.
 */
abstract class WidgetProviderBase : AppWidgetProvider() {
    internal abstract val kind: WidgetKind

    override fun onDisabled(context: Context) {
        try {
            WidgetRefreshSchedule.cancelIfUnused(context)
        } catch (_: Exception) {
            // Match onEnabled's best-effort behavior if WorkManager is unavailable.
        }
    }

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
        renderAsync(context, appWidgetIds)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        renderAsync(context, intArrayOf(appWidgetId))
    }

    private fun renderAsync(
        context: Context,
        appWidgetIds: IntArray,
    ) {
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                withTimeout(8000L) {
                    WidgetUpdates.refresh(context.applicationContext, kind, appWidgetIds)
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // Best-effort: leave existing widget content on failure.
            } finally {
                pending.finish()
            }
        }
    }

    internal abstract suspend fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        snapshot: () -> ExpenseWidgetStore.Snapshot,
    )

    protected fun store(context: Context): ExpenseWidgetStore {
        val app = context.applicationContext
        val mmkv = MmkvAndroidReader(app)
        return ExpenseWidgetStore(mmkv, SettingsAndroidReader(mmkv))
    }

    protected fun assistFor(context: Context): WidgetAssist? =
        try {
            WidgetAssistStore(context.applicationContext).load()
        } catch (_: Exception) {
            null
        }

    /** Currency for empty states: assist hint, else settings default, else INR. */
    protected fun displayCurrency(context: Context): String {
        val app = context.applicationContext
        WidgetAssistStore(app)
            .load()
            ?.currency
            ?.takeIf { it.isNotEmpty() }
            ?.let { return it }
        return SettingsAndroidReader(MmkvAndroidReader(app)).defaultCurrency()
    }
}
