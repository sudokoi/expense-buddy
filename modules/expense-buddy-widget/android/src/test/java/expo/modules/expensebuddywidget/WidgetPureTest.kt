package expo.modules.expensebuddywidget

import android.content.res.Configuration
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.util.Locale

class TrendChartRendererTest {
    @Test
    fun `fractions normalize against max`() {
        assertThat(TrendChartRenderer.fractions(listOf(0.0, 50.0, 100.0)))
            .containsExactly(0f, 0.5f, 1f)
            .inOrder()
    }

    @Test
    fun `fractions are zero when max is zero`() {
        assertThat(TrendChartRenderer.fractions(listOf(0.0, 0.0)))
            .containsExactly(0f, 0f)
    }

    @Test
    fun `fractions of empty is empty`() {
        assertThat(TrendChartRenderer.fractions(emptyList())).isEmpty()
    }

    @Test
    fun `single month labels are day numbers`() {
        val days = listOf(DayTotal("2026-09-02", 1.0), DayTotal("2026-09-03", 2.0))
        assertThat(TrendChartRenderer.dayLabels(days, java.util.Locale.ENGLISH))
            .containsExactly("2", "3")
            .inOrder()
    }

    @Test
    fun `cross-month span names edge months`() {
        val days = listOf(DayTotal("2026-08-30", 1.0), DayTotal("2026-08-31", 1.0), DayTotal("2026-09-01", 1.0))
        assertThat(TrendChartRenderer.dayLabels(days, java.util.Locale.ENGLISH))
            .containsExactly("30 Aug", "31", "1 Sep")
            .inOrder()
    }

    @Test
    fun `year boundary names both months`() {
        val days = listOf(DayTotal("2025-12-31", 1.0), DayTotal("2026-01-01", 1.0))
        assertThat(TrendChartRenderer.dayLabels(days, java.util.Locale.ENGLISH))
            .containsExactly("31 Dec", "1 Jan")
            .inOrder()
    }

    @Test
    fun `corrupt day keys fall back to raw suffix`() {
        val days = listOf(DayTotal("2026-13-99", 1.0))
        assertThat(TrendChartRenderer.dayLabels(days, java.util.Locale.ENGLISH))
            .containsExactly("99")
    }

    @Test
    fun `bitmap size follows widget options and subtracts content chrome`() {
        assertThat(TrendChartRenderer.bitmapSize(320, 180, 2f)).isEqualTo(592 to 220)
    }

    @Test
    fun `monotone curve preserves every daily point`() {
        val points =
            listOf(
                TrendChartRenderer.ChartPoint(0f, 80f),
                TrendChartRenderer.ChartPoint(10f, 20f),
                TrendChartRenderer.ChartPoint(20f, 100f),
                TrendChartRenderer.ChartPoint(30f, 60f),
            )
        val segments = TrendChartRenderer.monotoneSegments(points)

        assertThat(segments.first().start).isEqualTo(points.first())
        assertThat(segments.map { it.end }).containsExactlyElementsIn(points.drop(1)).inOrder()
    }

    @Test
    fun `monotone curve clamps flat-to-steep transitions within adjacent totals`() {
        val points =
            listOf(
                TrendChartRenderer.ChartPoint(0f, 100f),
                TrendChartRenderer.ChartPoint(20f, 101f),
                TrendChartRenderer.ChartPoint(40f, 150f),
                TrendChartRenderer.ChartPoint(60f, 200f),
            )

        TrendChartRenderer.monotoneSegments(points).forEach { segment ->
            val minimum = minOf(segment.start.y, segment.end.y)
            val maximum = maxOf(segment.start.y, segment.end.y)
            assertThat(segment.control1.y).isAtLeast(minimum)
            assertThat(segment.control1.y).isAtMost(maximum)
            assertThat(segment.control2.y).isAtLeast(minimum)
            assertThat(segment.control2.y).isAtMost(maximum)
        }
    }
}

class WidgetThemeTest {
    @Test
    fun `explicit app theme overrides system night mode`() {
        assertThat(WidgetTheme.resolve("light", Configuration.UI_MODE_NIGHT_YES))
            .isEqualTo(WidgetTheme.LIGHT)
        assertThat(WidgetTheme.resolve("dark", Configuration.UI_MODE_NIGHT_NO))
            .isEqualTo(WidgetTheme.DARK)
    }

    @Test
    fun `system preference follows ui mode`() {
        assertThat(WidgetTheme.resolve("system", Configuration.UI_MODE_NIGHT_YES))
            .isEqualTo(WidgetTheme.DARK)
        assertThat(WidgetTheme.resolve("system", Configuration.UI_MODE_NIGHT_NO))
            .isEqualTo(WidgetTheme.LIGHT)
    }
}

class WidgetFormatTest {
    @Test
    fun `formats INR with symbol`() {
        val text = WidgetFormat.amount(1234.0, "INR", Locale.forLanguageTag("en-IN"))
        assertThat(text).contains("1,234")
    }

    @Test
    fun `unknown currency falls back to code prefix`() {
        assertThat(WidgetFormat.amount(10.5, "XXQ")).isEqualTo("XXQ 10.5")
    }

    @Test
    fun `maskedAmount hides when requested`() {
        assertThat(WidgetFormat.maskedAmount(100.0, "INR", true)).isEqualTo(WidgetFormat.HIDDEN)
        assertThat(WidgetFormat.maskedAmount(100.0, "XXQ", false)).isEqualTo("XXQ 100")
    }
}
