package expo.modules.expensebuddywidget

import android.content.Context
import com.tencent.mmkv.MMKV

/** Production adapter: reads the JS-owned MMKV file in multi-process mode. */
internal class MmkvAndroidReader(
    context: Context,
) : MmkvReader {
    private val kv: MMKV by lazy {
        MMKV.initialize(context.applicationContext)
        MMKV.mmkvWithID(WidgetKeys.MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    override fun getString(key: String): String? = kv.decodeString(key)

    override fun multiGet(keys: List<String>): List<Pair<String, String?>> = keys.map { it to kv.decodeString(it) }
}

/** Production settings adapter: best-effort parse of app_settings. */
internal class SettingsAndroidReader(
    private val mmkv: MmkvReader,
) : SettingsReader {
    override fun defaultCurrency(): String =
        try {
            val raw = mmkv.getString(WidgetKeys.SETTINGS) ?: return "INR"
            org.json
                .JSONObject(raw)
                .optString("defaultCurrency", "INR")
                .ifEmpty { "INR" }
        } catch (_: Exception) {
            "INR"
        }
}
