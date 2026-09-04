package expo.modules.expensebuddywidget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.core.content.ContextCompat
import androidx.core.graphics.withTranslation

/**
 * Renders 7-day bars to a bitmap (RemoteViews cannot host chart views).
 * [fractions] is pure and unit-tested; [render] only maps fractions to pixels.
 */
internal object TrendChartRenderer {
    fun fractions(totals: List<Double>): List<Float> {
        if (totals.isEmpty()) return emptyList()
        val max = totals.maxOrNull() ?: 0.0
        if (max <= 0.0) return totals.map { 0f }
        return totals.map { (it / max).toFloat().coerceIn(0f, 1f) }
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
        val labelPaint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                textSize = 10 * density
                textAlign = Paint.Align.CENTER
            }

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
            canvas.withTranslation(centerX, heightPx - 2 * density) {
                drawText(day.dayKey.substring(8), 0f, 0f, labelPaint)
            }
        }
        return bitmap
    }
}
