package expo.modules.expensebuddywidget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import android.widget.Switch

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

        val existing = WidgetFilterStore(this, widgetId).load()
        val mmkv = MmkvAndroidReader(this)
        val labels =
            WidgetConfigData.categoryLabels(
                mmkv.getString(WidgetKeys.SETTINGS),
                WidgetAssistStore(this).load(),
            )
        val options = listOf(getString(R.string.expense_widget_config_all)) + labels

        val spinner = findViewById<Spinner>(R.id.config_category)
        spinner.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, options)
        val selectedIndex =
            existing.category?.let { labels.indexOf(it).takeIf { i -> i >= 0 }?.plus(1) } ?: 0
        spinner.setSelection(selectedIndex)

        val hideSwitch = findViewById<Switch>(R.id.config_hide_amounts)
        hideSwitch.isChecked = existing.hideAmounts

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
}
