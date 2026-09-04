package expo.modules.expensebuddywidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.core.content.ContextCompat
import androidx.core.graphics.withTranslation

/**
 * Renders 7-day bars with a trend line to a bitmap (RemoteViews cannot host
 * chart views). [fractions] and [dayLabels] are pure and unit-tested;
 * [render] only maps them to pixels.
 */
internal object TrendChartRenderer {
    fun fractions(totals: List<Double>): List<Float> {
        if (totals.isEmpty()) return emptyList()
        val max = totals.maxOrNull() ?: 0.0
        if (max <= 0.0) return totals.map { 0f }
        return totals.map { (it / max).toFloat().coerceIn(0f, 1f) }
    }

    /**
     * Day numbers, with month context at the range edges when the span
     * crosses a month boundary ("29 Aug … 4 Sep"). Locale-aware short names.
     */
    fun dayLabels(
        days: List<DayTotal>,
        locale: java.util.Locale = java.util.Locale.getDefault(),
    ): List<String> {
        val dates =
            days.map {
                try {
                    java.time.LocalDate.parse(it.dayKey)
                } catch (_: Exception) {
                    null
                }
            }
        if (dates.any { it == null }) return days.map { it.dayKey.substring(8) }
        val nonNull = dates.filterNotNull()
        val months = nonNull.map { java.time.YearMonth.from(it) }.toSet()
        if (months.size <= 1) return nonNull.map { it.dayOfMonth.toString() }
        val monthName = { date: java.time.LocalDate ->
            date.month.getDisplayName(java.time.format.TextStyle.SHORT, locale)
        }
        return nonNull.mapIndexed { index, date ->
            when (index) {
                0 -> "${date.dayOfMonth} ${monthName(date)}"
                nonNull.lastIndex -> "${date.dayOfMonth} ${monthName(date)}"
                else -> date.dayOfMonth.toString()
            }
        }
    }

    fun render(
        context: Context,
        days: List<DayTotal>,
        widthPx: Int = (300 * context.resources.displayMetrics.density).toInt(),
        heightPx: Int = (120 * context.resources.displayMetrics.density).toInt(),
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        if (days.isEmpty()) return bitmap
        val canvas = Canvas(bitmap)
        val density = context.resources.displayMetrics.density
        val barColor = ContextCompat.getColor(context, R.color.expense_widget_accent)
        val trackColor = ContextCompat.getColor(context, R.color.expense_widget_track)
        val labelColor = ContextCompat.getColor(context, R.color.expense_widget_text_muted)

        val labelHeight = 14 * density
        val plotHeight = heightPx - labelHeight
        val slot = widthPx / days.size.toFloat()
        val barWidth = (slot * 0.5f).coerceAtLeast(2 * density)
        val radius = (barWidth / 2).coerceAtMost(6 * density)
        val fracs = fractions(days.map { it.total })

        val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = barColor }
        val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = trackColor }
        val linePaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = ContextCompat.getColor(context, R.color.expense_widget_text_primary)
                strokeWidth = 2 * density
                style = Paint.Style.STROKE
            }
        val dotPaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = ContextCompat.getColor(context, R.color.expense_widget_text_primary)
            }
        val labelPaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                textSize = 10 * density
                textAlign = Paint.Align.CENTER
            }

        val labels = dayLabels(days)
        val tops = mutableListOf<Pair<Float, Float>>()
        days.forEachIndexed { index, day ->
            val centerX = slot * index + slot / 2
            val left = centerX - barWidth / 2
            // Faint full-height track so zero days still read as slots.
            canvas.drawRoundRect(left, 0f, left + barWidth, plotHeight, radius, radius, trackPaint)
            val barHeight =
                (fracs[index] * plotHeight).coerceAtLeast(
                    if (day.total > 0) 3 * density else 0f,
                )
            if (barHeight > 0) {
                canvas.drawRoundRect(
                    left,
                    plotHeight - barHeight,
                    left + barWidth,
                    plotHeight,
                    radius,
                    radius,
                    barPaint,
                )
            }
            tops.add(centerX to (plotHeight - barHeight))
            canvas.withTranslation(centerX, heightPx - 2 * density) {
                drawText(labels[index], 0f, 0f, labelPaint)
            }
        }
        // Trend line through the bar tops, skipped where nothing was spent.
        if (tops.size > 1 && fracs.any { it > 0 }) {
            val path = android.graphics.Path()
            var started = false
            tops.forEachIndexed { index, (x, y) ->
                if (fracs[index] <= 0) {
                    started = false
                } else if (!started) {
                    path.moveTo(x, y)
                    started = true
                } else {
                    path.lineTo(x, y)
                }
            }
            canvas.drawPath(path, linePaint)
            tops.forEachIndexed { index, (x, y) ->
                if (fracs[index] > 0) canvas.drawCircle(x, y, 2.5f * density, dotPaint)
            }
        }
        return bitmap
    }
}
