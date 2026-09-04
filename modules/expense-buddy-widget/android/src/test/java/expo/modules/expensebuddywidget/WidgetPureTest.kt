package expo.modules.expensebuddywidget

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
}

class WidgetFormatTest {
    @Test
    fun `formats INR with symbol`() {
        val text = WidgetFormat.amount(1234.0, "INR", Locale("en", "IN"))
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
