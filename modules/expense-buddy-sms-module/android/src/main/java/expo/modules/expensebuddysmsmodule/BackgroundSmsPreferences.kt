package expo.modules.expensebuddysmsmodule

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.expensebuddylogger.LoggerApi

private const val PREFS_NAME = "expense_buddy_background_sms"
private const val ENABLED_KEY = "enabled"
private const val SMS_REGION_KEY = "smsRegion"

/** Default when no region was ever pushed from JS (historical behavior). */
const val DEFAULT_SMS_REGION = "IN"

object BackgroundSmsPreferences {
    fun getScanPosition(
        context: Context,
        region: String = getSmsRegion(context),
    ): SmsScanPosition? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.contains("scanTimestampV2.$region")) return null
        return SmsScanPosition(prefs.getLong("scanTimestampV2.$region", 0), prefs.getLong("scanMessageIdV2.$region", -1))
    }

    fun setScanPosition(
        context: Context,
        position: SmsScanPosition,
        region: String = getSmsRegion(context),
    ) {
        check(
            context
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putLong("scanTimestampV2.$region", position.timestamp)
                .putLong("scanMessageIdV2.$region", position.messageId)
                .commit(),
        ) {
            "Could not persist SMS scan progress"
        }
    }

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
        // Apply PackageManager state first — if it fails, prefs stay unchanged,
        // avoiding a desync where prefs says enabled but the receiver is disabled.
        BackgroundSmsReceiverComponent.setEnabled(context, enabled)
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(ENABLED_KEY, enabled)
            .apply()
        // Soft-check consistency after both writes; OEM ROMs may lag/revert
        // PackageManager state — log instead of crashing (see PR 115 review).
        if (getState(context).enabled != enabled) {
            LoggerApi.e("SMS_STORAGE", "setEnabled: state mismatch after write, enabled=$enabled")
        }
    }

    fun getSmsRegion(context: Context): String =
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(SMS_REGION_KEY, null)
            ?.takeIf { it.isNotBlank() }
            ?: DEFAULT_SMS_REGION

    fun setSmsRegion(
        context: Context,
        region: String,
    ) {
        LoggerApi.d("SMS_STORAGE", "setSmsRegion: region=$region")
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(SMS_REGION_KEY, region.uppercase())
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

    private fun componentName(context: Context): ComponentName = ComponentName(context, ExpenseBuddySmsReceiver::class.java)
}
