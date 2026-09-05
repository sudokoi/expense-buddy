package expo.modules.expensebuddywidget

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
    ): List<String> = WidgetCategoryStyles.parse(settingsJson, assist).labels

    internal fun parseSettingsLabels(settingsJson: String?): List<String>? = WidgetCategoryStyles.parseSettings(settingsJson)?.labels
}
