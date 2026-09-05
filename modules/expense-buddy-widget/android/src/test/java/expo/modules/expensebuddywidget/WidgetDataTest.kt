package expo.modules.expensebuddywidget

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.LocalDate

class WidgetDataTest {
    @Test
    fun `each projection scans only when requested and memoizes within the snapshot`() {
        var visits = 0
        val rows =
            object : AbstractList<WidgetExpense>() {
                override val size = 100

                override fun get(index: Int): WidgetExpense {
                    visits++
                    return WidgetExpense("$index", 2.0, "INR", "Food", "", "2026-09-05", "same")
                }
            }
        val data = WidgetData("INR", rows, LocalDate.of(2026, 9, 5), 8, "same")
        assertThat(visits).isEqualTo(0)
        assertThat(data.todayTotal).isEqualTo(200.0)
        assertThat(data.todayCount).isEqualTo(100)
        assertThat(data.monthTotal).isEqualTo(200.0)
        assertThat(visits).isEqualTo(100)
        assertThat(data.last7Days.last().total).isEqualTo(200.0)
        assertThat(data.last7Days.dropLast(1).all { it.total == 0.0 }).isTrue()
        assertThat(visits).isEqualTo(200)
        assertThat(data.recent.map { it.id }).containsExactlyElementsIn((0..7).map { "$it" }).inOrder()
        assertThat(data.recent).hasSize(8)
        assertThat(visits).isEqualTo(300)
    }
}
