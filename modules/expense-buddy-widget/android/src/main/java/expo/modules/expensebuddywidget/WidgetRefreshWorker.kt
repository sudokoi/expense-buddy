package expo.modules.expensebuddywidget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * 30-minute backstop so widgets refresh even if the app is never opened
 * (sync-while-closed, reboot before first unlock). Numbers always come
 * from live MMKV; the broadcast is a no-op when no widgets are placed.
 */
class WidgetRefreshWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        WidgetRefresh.broadcastAll(applicationContext)
        return Result.success()
    }
}

internal object WidgetRefreshSchedule {
    const val WORK_NAME = "expense_widget_refresh"

    fun cancelIfUnused(context: Context) {
        val manager = android.appwidget.AppWidgetManager.getInstance(context)
        if (WidgetRefresh.widgetProviders(context).all { manager.getAppWidgetIds(it).isEmpty() }) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    fun ensure(context: Context) {
        val request =
            PeriodicWorkRequestBuilder<WidgetRefreshWorker>(30, TimeUnit.MINUTES).build()
        WorkManager
            .getInstance(context.applicationContext)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
