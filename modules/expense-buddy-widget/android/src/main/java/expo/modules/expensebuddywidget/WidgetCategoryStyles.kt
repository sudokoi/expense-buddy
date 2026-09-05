package expo.modules.expensebuddywidget

import android.graphics.Color
import org.json.JSONObject

/** Live category order/colors from app_settings, with assist as degraded fallback. */
internal data class WidgetCategoryStyles(
    val labels: List<String>,
    private val colors: Map<String, String>,
) {
    fun ordered(available: Set<String>): List<String> = labels.filter { it in available } + (available - labels.toSet()).sorted()

    fun color(
        category: String,
        fallback: Int,
    ): Int =
        try {
            colors[category]?.let(Color::parseColor) ?: fallback
        } catch (_: Exception) {
            fallback
        }

    companion object {
        fun parse(
            settingsJson: String?,
            assist: WidgetAssist?,
        ): WidgetCategoryStyles {
            parseSettings(settingsJson)?.let { return it }
            val fallbackColors = assist?.categoryColors.orEmpty()
            val fallbackLabels = fallbackColors.keys.sorted().ifEmpty { listOf("Other") }
            return WidgetCategoryStyles(fallbackLabels, fallbackColors)
        }

        internal fun parseSettings(settingsJson: String?): WidgetCategoryStyles? {
            try {
                if (settingsJson.isNullOrEmpty()) return null
                val arr = JSONObject(settingsJson).optJSONArray("categories") ?: return null
                val labels = mutableListOf<String>()
                val colors = mutableMapOf<String, String>()
                for (i in 0 until arr.length()) {
                    val category = arr.optJSONObject(i) ?: continue
                    val label = category.optString("label", "")
                    if (label.isEmpty()) continue
                    labels.add(label)
                    category.optString("color", "").takeIf { it.isNotEmpty() }?.let {
                        colors[label] = it
                    }
                }
                if (labels.isEmpty()) return null
                return WidgetCategoryStyles(labels.distinct(), colors)
            } catch (_: Exception) {
                return null
            }
        }
    }
}
