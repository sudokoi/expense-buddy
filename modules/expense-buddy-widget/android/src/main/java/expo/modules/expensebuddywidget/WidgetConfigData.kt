package expo.modules.expensebuddywidget

import org.json.JSONObject

/**
 * Category source for the config screen. Live `app_settings` first
 * (stored order), assist `categoryColors` keys as fallback so the screen
 * still works before the app ever runs the assist hook.
 */
internal object WidgetConfigData {
    const val ALL = "__all__"

    fun categoryLabels(
        settingsJson: String?,
        assist: WidgetAssist?,
    ): List<String> {
        parseSettingsLabels(settingsJson)?.let { return it }
        val fallback = assist?.categoryColors?.keys?.sorted()
        if (!fallback.isNullOrEmpty()) return fallback
        return listOf("Other")
    }

    internal fun parseSettingsLabels(settingsJson: String?): List<String>? {
        try {
            if (settingsJson.isNullOrEmpty()) return null
            val arr = JSONObject(settingsJson).optJSONArray("categories") ?: return null
            return buildList {
                for (i in 0 until arr.length()) {
                    val label = arr.optJSONObject(i)?.optString("label", "") ?: ""
                    if (label.isNotEmpty()) add(label)
                }
            }.takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            return null
        }
    }
}
