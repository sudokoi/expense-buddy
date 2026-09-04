package expo.modules.expensebuddywidget

import android.content.Context
import org.json.JSONObject

/**
 * Assist prefs reader. Hints only — numbers are recomputed from live rows.
 * Writer lives in `services/widget-assist.ts` via the bridge module.
 */
internal class WidgetAssistStore(
    private val context: Context,
) {
    fun load(): WidgetAssist? {
        val raw =
            context
                .getSharedPreferences(WidgetKeys.ASSIST_PREFS, Context.MODE_PRIVATE)
                .getString(WidgetKeys.ASSIST_KEY, null) ?: return null
        return WidgetAssist.fromJson(raw)
    }

    fun save(assistJson: String) {
        context
            .getSharedPreferences(WidgetKeys.ASSIST_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(WidgetKeys.ASSIST_KEY, assistJson)
            .apply()
    }

    companion object {
        fun buildAssistJson(
            dataVersion: String,
            currency: String,
            categoryColors: Map<String, String>,
        ): String =
            JSONObject()
                .put("dataVersion", dataVersion)
                .put("currency", currency)
                .put("categoryColors", JSONObject(categoryColors as Map<*, *>))
                .toString()
    }
}
