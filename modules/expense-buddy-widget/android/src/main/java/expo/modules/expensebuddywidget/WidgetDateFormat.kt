package expo.modules.expensebuddywidget

import android.icu.text.DateFormat
import java.text.NumberFormat
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import java.util.Locale

/** Locale-correct compact dates for constrained widget surfaces. */
internal object WidgetDateFormat {
    fun dayMonth(
        date: LocalDate,
        locale: Locale = Locale.getDefault(),
    ): String =
        try {
            formatter("MMMd", locale).format(date.toDate())
        } catch (_: RuntimeException) {
            // Plain JVM tests do not provide android.icu; device rendering does.
            "${date.dayOfMonth} ${date.month.getDisplayName(java.time.format.TextStyle.SHORT, locale)}"
        }

    fun dayNumber(
        date: LocalDate,
        locale: Locale = Locale.getDefault(),
    ): String = NumberFormat.getIntegerInstance(locale).format(date.dayOfMonth)

    fun dayMonth(
        dayKey: String,
        locale: Locale = Locale.getDefault(),
    ): String =
        try {
            dayMonth(LocalDate.parse(dayKey), locale)
        } catch (_: Exception) {
            dayKey
        }

    private fun formatter(
        skeleton: String,
        locale: Locale,
    ): DateFormat = DateFormat.getInstanceForSkeleton(skeleton, locale)

    private fun LocalDate.toDate(): Date = Date.from(atStartOfDay(ZoneId.systemDefault()).toInstant())
}
