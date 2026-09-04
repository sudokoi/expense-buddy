package expo.modules.expensebuddywidget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * System-event freshness without JS: midnight rollover, clock/timezone
 * changes, and reboot all re-render from live MMKV (ADR-012).
 * Manifest-registered by the config plugin.
 */
class WidgetSystemReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            -> WidgetRefresh.broadcastAll(context.applicationContext)
            else -> Unit
        }
    }
}
