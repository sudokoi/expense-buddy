package expo.modules.expensebuddywidget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ImageView
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.view.WindowInsetsControllerCompat

/**
 * `android:configure` screen for all three widget kinds. Writes the
 * per-instance [WidgetFilter], broadcasts a refresh, and returns
 * `RESULT_OK` so the host places the widget. Back-out leaves
 * `RESULT_CANCELED` and nothing is placed.
 */
class WidgetConfigActivity : Activity() {
    private var widgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        widgetId =
            intent.getIntExtra(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID,
            )
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        setResult(RESULT_CANCELED)

        setContentView(R.layout.expense_widget_config)
        val theme = WidgetTheme.resolve(this)
        applyTheme(theme)

        // Labels come from the assist copy (translation.json single source);
        // layout android:text values are the Android-localized fallback when no assist
        // exists yet (e.g. first placement before the app ever ran).
        val assist = WidgetAssistStore(this).load()
        val copy = assist.toCopy(this)
        val hideSwitch = findViewById<Switch>(R.id.config_hide_amounts)
        findViewById<TextView>(R.id.config_title).text = copy.configTitle
        findViewById<TextView>(R.id.config_subtitle).text = copy.configSubtitle
        findViewById<TextView>(R.id.config_category_label).text = copy.configCategory
        hideSwitch.text = copy.configHide
        val saveButton = findViewById<Button>(R.id.config_save)
        saveButton.text = copy.configSave
        saveButton.isAllCaps = false
        saveButton.backgroundTintList = null
        saveButton.setBackgroundResource(theme.buttonBackground)
        saveButton.setTextColor(theme.color(this, theme.accentForeground))

        val existing = WidgetFilterStore(this, widgetId).load()
        val mmkv = MmkvAndroidReader(this)
        val labels =
            WidgetConfigData.categoryLabels(
                mmkv.getString(WidgetKeys.SETTINGS),
                assist,
            )
        val options = listOf(copy.configAll) + labels.map { copy.displayCategory(it) }

        val spinner = findViewById<Spinner>(R.id.config_category)
        spinner.adapter =
            object : ArrayAdapter<String>(this, R.layout.expense_widget_spinner_item, options) {
                override fun getView(
                    position: Int,
                    convertView: android.view.View?,
                    parent: android.view.ViewGroup,
                ): android.view.View =
                    super.getView(position, convertView, parent).also {
                        (it as TextView).setTextColor(theme.color(this@WidgetConfigActivity, theme.foreground))
                    }

                override fun getDropDownView(
                    position: Int,
                    convertView: android.view.View?,
                    parent: android.view.ViewGroup,
                ): android.view.View =
                    super.getDropDownView(position, convertView, parent).also {
                        (it as TextView).setTextColor(theme.color(this@WidgetConfigActivity, theme.foreground))
                    }
            }.also {
                it.setDropDownViewResource(R.layout.expense_widget_spinner_dropdown)
            }
        spinner.setBackgroundResource(theme.controlBackground)
        spinner.setPopupBackgroundResource(theme.popupBackground)
        val selectedIndex =
            existing.category?.let { labels.indexOf(it).takeIf { i -> i >= 0 }?.plus(1) } ?: 0
        spinner.setSelection(selectedIndex)

        hideSwitch.isChecked = existing.hideAmounts
        val accent = theme.color(this, theme.accent)
        val muted = theme.color(this, theme.mutedForeground)
        val border = theme.color(this, theme.border)
        val states = arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf())
        hideSwitch.thumbTintList =
            android.content.res.ColorStateList(states, intArrayOf(accent, muted))
        hideSwitch.trackTintList =
            android.content.res.ColorStateList(
                states,
                intArrayOf(
                    ColorUtils.setAlphaComponent(accent, 102),
                    ColorUtils.setAlphaComponent(border, 153),
                ),
            )
        findViewById<Button>(R.id.config_save).setOnClickListener {
            val position = spinner.selectedItemPosition
            val category = if (position <= 0) null else labels[position - 1]
            WidgetFilterStore(this, widgetId).save(
                WidgetFilter(category = category, hideAmounts = hideSwitch.isChecked),
            )
            WidgetRefresh.broadcastAll(this)
            setResult(
                RESULT_OK,
                Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId),
            )
            finish()
        }
    }

    private fun applyTheme(theme: WidgetTheme) {
        val background = theme.color(this, theme.background)
        val foreground = theme.color(this, theme.foreground)
        val muted = theme.color(this, theme.mutedForeground)
        window.statusBarColor = background
        window.navigationBarColor = background
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = theme == WidgetTheme.LIGHT
            isAppearanceLightNavigationBars = theme == WidgetTheme.LIGHT
        }
        findViewById<ScrollView>(R.id.config_root).setBackgroundColor(background)
        findViewById<TextView>(R.id.config_title).setTextColor(foreground)
        findViewById<TextView>(R.id.config_subtitle).setTextColor(muted)
        findViewById<TextView>(R.id.config_category_label).setTextColor(muted)
        findViewById<Switch>(R.id.config_hide_amounts).setTextColor(foreground)
        findViewById<ImageView>(R.id.config_category_arrow).setColorFilter(muted)
    }
}
