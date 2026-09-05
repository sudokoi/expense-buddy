package expo.modules.expensebuddywidget

import android.content.Context
import android.content.res.Configuration
import android.widget.RemoteViews
import org.json.JSONObject

/** Resolves the app's explicit theme preference for launcher-hosted RemoteViews. */
internal enum class WidgetTheme(
    val background: Int,
    val foreground: Int,
    val mutedForeground: Int,
    val border: Int,
    val accent: Int,
    val accentForeground: Int,
    val cardBackground: Int,
    val addBackground: Int,
    val controlBackground: Int,
    val popupBackground: Int,
    val buttonBackground: Int,
) {
    LIGHT(
        R.color.expense_widget_background_light,
        R.color.expense_widget_text_primary_light,
        R.color.expense_widget_text_muted_light,
        R.color.expense_widget_track_light,
        R.color.expense_widget_accent_light,
        R.color.expense_widget_accent_text_light,
        R.drawable.expense_widget_bg_light,
        R.drawable.expense_widget_add_bg_light,
        R.drawable.expense_widget_control_bg_light,
        R.drawable.expense_widget_popup_bg_light,
        R.drawable.expense_widget_button_bg_light,
    ),
    DARK(
        R.color.expense_widget_background_dark,
        R.color.expense_widget_text_primary_dark,
        R.color.expense_widget_text_muted_dark,
        R.color.expense_widget_track_dark,
        R.color.expense_widget_accent_dark,
        R.color.expense_widget_accent_text_dark,
        R.drawable.expense_widget_bg_dark,
        R.drawable.expense_widget_add_bg_dark,
        R.drawable.expense_widget_control_bg_dark,
        R.drawable.expense_widget_popup_bg_dark,
        R.drawable.expense_widget_button_bg_dark,
    ),
    ;

    fun color(
        context: Context,
        resource: Int,
    ): Int = context.getColor(resource)

    fun applyCard(
        context: Context,
        views: RemoteViews,
        rootId: Int,
        primaryTextIds: IntArray = intArrayOf(),
        mutedTextIds: IntArray = intArrayOf(),
    ) {
        views.setInt(rootId, "setBackgroundResource", cardBackground)
        val primary = color(context, foreground)
        val muted = color(context, mutedForeground)
        primaryTextIds.forEach { views.setTextColor(it, primary) }
        mutedTextIds.forEach { views.setTextColor(it, muted) }
    }

    companion object {
        fun resolve(context: Context): WidgetTheme {
            val preference =
                try {
                    MmkvAndroidReader(context.applicationContext)
                        .getString(WidgetKeys.SETTINGS)
                        ?.let { JSONObject(it).optString("theme", "system") }
                } catch (_: Exception) {
                    null
                }
            return resolve(preference, context.resources.configuration.uiMode)
        }

        internal fun resolve(
            preference: String?,
            uiMode: Int,
        ): WidgetTheme =
            when (preference) {
                "light" -> LIGHT
                "dark" -> DARK
                else ->
                    if (uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES) {
                        DARK
                    } else {
                        LIGHT
                    }
            }
    }
}
