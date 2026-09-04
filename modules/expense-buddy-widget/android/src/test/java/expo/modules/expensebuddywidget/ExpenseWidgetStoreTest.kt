package expo.modules.expensebuddywidget

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.time.ZoneId

private class FakeMmkv(
    private val map: Map<String, String?>,
) : MmkvReader {
    override fun getString(key: String): String? = map[key]

    override fun multiGet(keys: List<String>): List<Pair<String, String?>> = keys.map { it to map[it] }
}

private fun expenseJson(
    id: String,
    amount: Double,
    date: String,
    category: String = "Food",
    updatedAt: String = "2026-09-04T10:00:00.000Z",
    deleted: Boolean = false,
    currency: String = "INR",
): String {
    val deletedPart = if (deleted) """, "deletedAt": "2026-09-04T11:00:00.000Z"""" else ""
    return (
        """{"id":"$id","amount":$amount,"currency":"$currency","category":"$category","date":"$date","note":"n","createdAt":"$updatedAt","updatedAt":"$updatedAt"$deletedPart}"""
    )
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ExpenseWidgetStoreTest {
    private val zone = ZoneId.of("Asia/Kolkata")
    private val settings = SettingsReader { "INR" }

    @Test
    fun `missing index is Unavailable`() {
        val store = ExpenseWidgetStore(FakeMmkv(emptyMap()), settings, zone)
        assertThat(store.read(LocalDate.of(2026, 9, 4))).isEqualTo(WidgetResult.Unavailable)
    }

    @Test
    fun `empty index is Empty`() {
        val store = ExpenseWidgetStore(FakeMmkv(mapOf(WidgetKeys.EXPENSES_INDEX to "[]")), settings, zone)
        assertThat(store.read(LocalDate.of(2026, 9, 4))).isEqualTo(WidgetResult.Empty)
    }

    @Test
    fun `soft-deleted and corrupt items are skipped`() {
        val map =
            mapOf(
                WidgetKeys.EXPENSES_INDEX to """["a","b","c"]""",
                WidgetKeys.itemKey("a") to expenseJson("a", 100.0, "2026-09-04T05:00:00.000Z"),
                WidgetKeys.itemKey("b") to expenseJson("b", 50.0, "2026-09-04T05:00:00.000Z", deleted = true),
                WidgetKeys.itemKey("c") to "not-json",
            )
        val store = ExpenseWidgetStore(FakeMmkv(map), settings, zone)
        val result = store.read(LocalDate.of(2026, 9, 4))
        val ready = result as WidgetResult.Ready
        assertThat(ready.data.todayTotal).isWithin(0.001).of(100.0)
        assertThat(ready.data.todayCount).isEqualTo(1)
    }

    @Test
    fun `amounts use abs and last7Days zero-fills`() {
        val map =
            mapOf(
                WidgetKeys.EXPENSES_INDEX to """["a"]""",
                WidgetKeys.itemKey("a") to expenseJson("a", -200.0, "2026-09-02T05:00:00.000Z"),
            )
        val store = ExpenseWidgetStore(FakeMmkv(map), settings, zone)
        val ready = store.read(LocalDate.of(2026, 9, 4)) as WidgetResult.Ready
        assertThat(ready.data.last7Days).hasSize(7)
        assertThat(
            ready.data.last7Days
                .last()
                .dayKey,
        ).isEqualTo("2026-09-04")
        assertThat(
            ready.data.last7Days
                .first()
                .dayKey,
        ).isEqualTo("2026-08-29")
        val sep2 = ready.data.last7Days.first { it.dayKey == "2026-09-02" }
        assertThat(sep2.total).isWithin(0.001).of(200.0)
        val sep4 = ready.data.last7Days.first { it.dayKey == "2026-09-04" }
        assertThat(sep4.total).isWithin(0.001).of(0.0)
    }

    @Test
    fun `category filter applies`() {
        val map =
            mapOf(
                WidgetKeys.EXPENSES_INDEX to """["a","b"]""",
                WidgetKeys.itemKey("a") to expenseJson("a", 100.0, "2026-09-04T05:00:00.000Z", category = "Food"),
                WidgetKeys.itemKey("b") to expenseJson("b", 300.0, "2026-09-04T05:00:00.000Z", category = "Rent"),
            )
        val store = ExpenseWidgetStore(FakeMmkv(map), settings, zone)
        val ready =
            store.read(LocalDate.of(2026, 9, 4), WidgetFilter(category = "Rent")) as WidgetResult.Ready
        assertThat(ready.data.todayTotal).isWithin(0.001).of(300.0)
    }

    @Test
    fun `mixed currencies are grouped never summed`() {
        val map =
            mapOf(
                WidgetKeys.EXPENSES_INDEX to """["a","b"]""",
                WidgetKeys.itemKey("a") to expenseJson("a", 100.0, "2026-09-04T05:00:00.000Z", currency = "INR"),
                WidgetKeys.itemKey("b") to expenseJson("b", 300.0, "2026-09-04T05:00:00.000Z", currency = "USD"),
            )
        val store = ExpenseWidgetStore(FakeMmkv(map), settings, zone)
        // Fresh assist picks the INR group only.
        val ready =
            store.read(
                LocalDate.of(2026, 9, 4),
                assistCurrency = "INR",
                assistVersion = "2026-09-04T10:00:00.000Z",
            ) as WidgetResult.Ready
        assertThat(ready.data.currency).isEqualTo("INR")
        assertThat(ready.data.todayTotal).isWithin(0.001).of(100.0)
    }

    @Test
    fun `stale assist currency is ignored`() {
        val map =
            mapOf(
                WidgetKeys.EXPENSES_INDEX to """["a"]""",
                WidgetKeys.itemKey("a") to expenseJson("a", 100.0, "2026-09-04T05:00:00.000Z", currency = "INR"),
            )
        val store = ExpenseWidgetStore(FakeMmkv(map), settings, zone)
        val ready =
            store.read(
                LocalDate.of(2026, 9, 4),
                assistCurrency = "USD",
                assistVersion = "2020-01-01T00:00:00.000Z",
            ) as WidgetResult.Ready
        assertThat(ready.data.currency).isEqualTo("INR")
        assertThat(ready.data.todayTotal).isWithin(0.001).of(100.0)
    }

    @Test
    fun `recent is newest first regardless of index order`() {
        val map =
            mapOf(
                WidgetKeys.EXPENSES_INDEX to """["old","new"]""",
                WidgetKeys.itemKey("old") to expenseJson("old", 10.0, "2026-09-01T05:00:00.000Z"),
                WidgetKeys.itemKey("new") to expenseJson("new", 20.0, "2026-09-04T05:00:00.000Z"),
            )
        val store = ExpenseWidgetStore(FakeMmkv(map), settings, zone)
        val ready = store.read(LocalDate.of(2026, 9, 4)) as WidgetResult.Ready
        assertThat(ready.data.recent.map { it.id }).containsExactly("new", "old").inOrder()
    }
}
