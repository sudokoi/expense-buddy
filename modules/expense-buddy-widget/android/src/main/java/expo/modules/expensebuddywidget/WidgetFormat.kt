package expo.modules.expensebuddywidget

import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/** Best-effort amount rendering. Falls back to `CODE amount` on unknown codes. */
internal object WidgetFormat {
    const val HIDDEN = "•••"

    fun amount(
        value: Double,
        currencyCode: String,
        locale: Locale = Locale.getDefault(),
    ): String =
        try {
            val currency = Currency.getInstance(currencyCode)
            val format = NumberFormat.getCurrencyInstance(locale)
            format.currency = currency
            format.maximumFractionDigits =
                if (currency.defaultFractionDigits < 0) 2 else currency.defaultFractionDigits
            format.format(value)
        } catch (_: Exception) {
            "$currencyCode ${trimTrailingZeros(value)}"
        }

    /** Single owner of the hide-amounts branch repeated across providers. */
    fun maskedAmount(
        value: Double,
        currencyCode: String,
        hidden: Boolean,
        locale: Locale = Locale.getDefault(),
    ): String = if (hidden) HIDDEN else amount(value, currencyCode, locale)

    private fun trimTrailingZeros(value: Double): String =
        if (value == kotlin.math.floor(value) && !value.isInfinite()) {
            value.toLong().toString()
        } else {
            value.toString()
        }
}
