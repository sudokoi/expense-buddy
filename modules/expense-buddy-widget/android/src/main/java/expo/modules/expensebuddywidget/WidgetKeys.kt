package expo.modules.expensebuddywidget

/**
 * Single owner of every JS-persisted key the widget reads.
 * Mirrors `services/expense-storage.ts` and `services/settings-manager.ts`.
 * Callers must go through [ExpenseWidgetStore], never these strings directly.
 */
internal object WidgetKeys {
    const val MMKV_ID = "expense-buddy"
    const val EXPENSES_INDEX = "expenses:index:v1"
    const val EXPENSE_ITEM_PREFIX = "expenses:item:v1:"
    const val SETTINGS = "app_settings"

    const val ASSIST_PREFS = "expense_widget_assist"
    const val ASSIST_KEY = "widget_assist"

    fun itemKey(id: String): String = "$EXPENSE_ITEM_PREFIX$id"
}
