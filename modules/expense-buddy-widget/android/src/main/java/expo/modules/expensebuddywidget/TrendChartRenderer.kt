package expo.modules.expensebuddywidget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.os.Bundle
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
        if (dates.any { it == null }) return days.map { it.dayKey.takeLast(2) }
        val nonNull = dates.filterNotNull()
        val months = nonNull.map { java.time.YearMonth.from(it) }.toSet()
        if (months.size <= 1) return nonNull.map { WidgetDateFormat.dayNumber(it, locale) }
        return nonNull.mapIndexed { index, date ->
            when (index) {
                0, nonNull.lastIndex -> WidgetDateFormat.dayMonth(date, locale)
                else -> WidgetDateFormat.dayNumber(date, locale)
            }
        }
    }

    internal fun bitmapSize(
        options: Bundle,
        density: Float,
    ): Pair<Int, Int> =
        bitmapSize(
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300),
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 120),
            density,
        )

    internal fun bitmapSize(
        widgetWidthDp: Int,
        widgetHeightDp: Int,
        density: Float,
    ): Pair<Int, Int> {
        val chartWidthDp = (widgetWidthDp - 24).coerceAtLeast(156)
        val chartHeightDp = (widgetHeightDp - 70).coerceAtLeast(48)
        return (chartWidthDp.coerceAtMost(476) * density).toInt() to
            (chartHeightDp.coerceAtMost(220) * density).toInt()
    }

    fun render(
        context: Context,
        days: List<DayTotal>,
        options: Bundle,
        theme: WidgetTheme,
        locale: java.util.Locale = java.util.Locale.getDefault(),
    ): Bitmap {
        val density = context.resources.displayMetrics.density
        val (widthPx, heightPx) = bitmapSize(options, density)
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        if (days.isEmpty()) return bitmap
        val canvas = Canvas(bitmap)
        val barColor = theme.color(context, theme.accent)
        val trackColor = theme.color(context, theme.border)
        val labelColor = theme.color(context, theme.mutedForeground)

        val labelHeight = 14 * density
        val plotTop = 4 * density
        val plotBottom = heightPx - labelHeight
        val plotHeight = plotBottom - plotTop
        val slot = widthPx / days.size.toFloat()
        val barWidth = (slot * 0.5f).coerceAtLeast(2 * density)
        val radius = (barWidth / 2).coerceAtMost(6 * density)
        val fracs = fractions(days.map { it.total })

        val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = barColor }
        val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = trackColor }
        val linePaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = theme.color(context, theme.foreground)
                strokeWidth = 2 * density
                style = Paint.Style.STROKE
            }
        val dotPaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = theme.color(context, theme.foreground)
            }
        val labelPaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                textSize = 10 * density
                textAlign = Paint.Align.CENTER
            }

        val labels = dayLabels(days, locale)
        val tops = mutableListOf<Pair<Float, Float>>()
        days.forEachIndexed { index, day ->
            val centerX = slot * index + slot / 2
            val left = centerX - barWidth / 2
            // Faint full-height track so zero days still read as slots.
            canvas.drawRoundRect(left, plotTop, left + barWidth, plotBottom, radius, radius, trackPaint)
            val barHeight =
                (fracs[index] * plotHeight).coerceAtLeast(
                    if (day.total > 0) 3 * density else 0f,
                )
            if (barHeight > 0) {
                canvas.drawRoundRect(
                    left,
                    plotBottom - barHeight,
                    left + barWidth,
                    plotBottom,
                    radius,
                    radius,
                    barPaint,
                )
            }
            tops.add(centerX to (plotBottom - barHeight))
            canvas.withTranslation(centerX, heightPx - 2 * density) {
                drawText(labels[index], 0f, 0f, labelPaint)
            }
        }
        // A zero is data, not a gap: keep the line continuous down to baseline.
        if (tops.size > 1 && fracs.any { it > 0 }) {
            val path = android.graphics.Path()
            tops.forEachIndexed { index, (x, y) ->
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            canvas.drawPath(path, linePaint)
            tops.forEach { (x, y) ->
                canvas.drawCircle(x, y, 2.5f * density, dotPaint)
            }
        }
        return bitmap
    }
}
