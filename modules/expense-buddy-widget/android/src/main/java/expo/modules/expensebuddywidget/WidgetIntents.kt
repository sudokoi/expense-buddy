package expo.modules.expensebuddywidget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Deep-link intents. Root taps open the app, `+` opens the add-expense tab,
 * list rows open history — mirroring the expo-router `myapp://` scheme.
 */
internal object WidgetIntents {
    fun openApp(
        context: Context,
        path: String,
        requestCode: Int,
    ): PendingIntent {
        val launch =
            context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse("myapp://$path")
                } ?: Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                setPackage(context.packageName)
            }
        return PendingIntent.getActivity(
            context,
            requestCode,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
