package expo.modules.expensebuddybackgroundsms

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.expensebuddylogger.LoggerApi

private const val PREFS_NAME = "expense_buddy_background_sms"
private const val ENABLED_KEY = "enabled"
private const val LAST_SCAN_CURSOR_KEY = "lastScanCursor"

object BackgroundSmsPreferences {
    fun getState(context: Context): BackgroundSmsState {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return BackgroundSmsState(
            enabled =
                prefs.getBoolean(ENABLED_KEY, false) &&
                    BackgroundSmsReceiverComponent.isEnabled(context),
        )
    }

    fun setEnabled(
        context: Context,
        enabled: Boolean,
    ) {
        LoggerApi.d("SMS_STORAGE", "setEnabled: enabled=$enabled")
        BackgroundSmsReceiverComponent.setEnabled(context, enabled)
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(ENABLED_KEY, enabled)
            .apply()
    }

    fun getLastScanCursor(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(LAST_SCAN_CURSOR_KEY, null)
    }

    fun setLastScanCursor(
        context: Context,
        cursor: String?,
    ) {
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(LAST_SCAN_CURSOR_KEY, cursor)
            .apply()
    }
}

private object BackgroundSmsReceiverComponent {
    fun isEnabled(context: Context): Boolean {
        val componentState = context.packageManager.getComponentEnabledSetting(componentName(context))
        return componentState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
    }

    fun setEnabled(
        context: Context,
        enabled: Boolean,
    ) {
        val targetState =
            if (enabled) {
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            } else {
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            }

        context.packageManager.setComponentEnabledSetting(
            componentName(context),
            targetState,
            PackageManager.DONT_KILL_APP,
        )

        check(isEnabled(context) == enabled) {
            "Failed to sync the background SMS receiver component state."
        }
    }

    private fun componentName(context: Context): ComponentName = ComponentName(context, ExpenseBuddyBackgroundSmsReceiver::class.java)
}
