package expo.modules.expensebuddybackgroundsms

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.expensebuddylogger.LoggerApi
import org.json.JSONObject

private const val PREFS_NAME = "expense_buddy_background_sms"
private const val ENABLED_KEY = "enabled"

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

internal fun JSONObject.optNullableString(key: String): String? = if (isNull(key)) null else optString(key, null)

internal fun JSONObject.optNullableDouble(key: String): Double? = if (isNull(key) || !has(key)) null else optDouble(key)
