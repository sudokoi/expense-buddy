package expo.modules.expensebuddywidget

/**
 * Seam for the MMKV store. Production adapter wraps `com.tencent:mmkv`
 * with `MULTI_PROCESS_MODE`; tests supply the fake (two adapters = real seam).
 *
 * Public because it appears in the public [ExpenseWidgetStore] constructor.
 */
interface MmkvReader {
    fun getString(key: String): String?

    fun multiGet(keys: List<String>): List<Pair<String, String?>>
}

fun interface SettingsReader {
    fun defaultCurrency(): String
}
