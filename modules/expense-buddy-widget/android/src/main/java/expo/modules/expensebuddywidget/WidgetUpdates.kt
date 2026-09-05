package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/** Process-owned renderer; retains application context only, never a receiver or Activity. */
internal object WidgetUpdates {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = WidgetUpdateQueue()
    private var worker: Job? = null

    suspend fun refresh(
        context: Context,
        kind: WidgetKind,
        ids: IntArray,
    ) {
        val installed =
            AppWidgetManager
                .getInstance(context)
                .getAppWidgetIds(ComponentName(context, kind.providerName))
                .toSet()
        val targets = ids.filter { it in installed }.map { WidgetTarget(kind, it) }.toSet()
        if (targets.isEmpty()) return
        start(context.applicationContext)
        queue.refresh(targets)
    }

    @Synchronized
    private fun start(app: Context) {
        if (worker != null) return
        worker =
            scope.launch {
                queue.run { targets -> withTimeout(7000L) { render(app, targets) } }
            }
    }

    private suspend fun render(
        app: Context,
        targets: Set<WidgetTarget>,
    ) {
        val manager = AppWidgetManager.getInstance(app)
        val snapshot by lazy {
            val mmkv = MmkvAndroidReader(app)
            ExpenseWidgetStore(mmkv, SettingsAndroidReader(mmkv)).capture()
        }
        for ((kind, widgets) in targets.groupBy { it.kind }) {
            val installed = manager.getAppWidgetIds(ComponentName(app, kind.providerName)).toSet()
            val provider =
                when (kind) {
                    WidgetKind.SUMMARY -> SummaryWidgetProvider()
                    WidgetKind.TREND -> TrendWidgetProvider()
                    WidgetKind.RECENT -> RecentWidgetProvider()
                }
            for (widget in widgets) {
                currentCoroutineContext().ensureActive()
                if (widget.id !in installed) continue
                try {
                    provider.render(app, manager, widget.id) { snapshot }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    android.util.Log.w("ExpenseWidget", "Could not render ${kind.name} widget ${widget.id}", error)
                }
            }
        }
    }
}
