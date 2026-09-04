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
