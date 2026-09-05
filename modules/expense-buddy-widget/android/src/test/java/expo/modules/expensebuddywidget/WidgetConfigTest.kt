package expo.modules.expensebuddywidget

import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WidgetFilterStoreTest {
    @Test
    fun `defaults are all-categories with visible amounts`() {
        val store = WidgetFilterStore(ApplicationProvider.getApplicationContext(), 42)
        assertThat(store.load()).isEqualTo(WidgetFilter(category = null, hideAmounts = false))
    }

    @Test
    fun `save and load round-trip per widget id`() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        WidgetFilterStore(context, 7).save(WidgetFilter(category = "Rent", hideAmounts = true))
        assertThat(WidgetFilterStore(context, 7).load())
            .isEqualTo(WidgetFilter(category = "Rent", hideAmounts = true))
        // A different instance is unaffected.
        assertThat(WidgetFilterStore(context, 8).load())
            .isEqualTo(WidgetFilter(category = null, hideAmounts = false))
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WidgetConfigDataTest {
    @Test
    fun `settings labels win over assist`() {
        val settings =
            """{"defaultCurrency":"INR","categories":[{"label":"Food"},{"label":"Rent"},{"label":""}]}"""
        val assist = WidgetAssist(dataVersion = "v", currency = "INR", categoryColors = mapOf("Zed" to "#fff"))
        assertThat(WidgetConfigData.categoryLabels(settings, assist))
            .containsExactly("Food", "Rent")
            .inOrder()
    }

    @Test
    fun `assist keys are fallback when settings miss`() {
        val assist =
            WidgetAssist(
                dataVersion = "v",
                currency = "INR",
                categoryColors = mapOf("Rent" to "#000", "Food" to "#fff"),
            )
        assertThat(WidgetConfigData.categoryLabels(null, assist))
            .containsExactly("Food", "Rent")
            .inOrder()
    }

    @Test
    fun `corrupt settings fall back to Other`() {
        assertThat(WidgetConfigData.categoryLabels("not-json", null))
            .containsExactly("Other")
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WidgetCopyTest {
    @Test
    fun `fallback formats counts and totals`() {
        val copy = WidgetCopy.fallback()
        assertThat(copy.expensesToday(1)).isEqualTo("1 expense today")
        assertThat(copy.expensesToday(5)).isEqualTo("5 expenses today")
        assertThat(copy.monthTotal("₹100")).isEqualTo("₹100 this month")
        assertThat(copy.displayCategory("Other")).isEqualTo("Other")
        assertThat(copy.displayCategory("Food")).isEqualTo("Food")
    }

    @Test
    fun `assist copy parses and maps Other`() {
        val json =
            """{"dataVersion":"v","currency":"INR","categoryColors":{},
              "copy":{"today":"Heute","last7Days":"L7","recent":"R","empty":"E",
              "expensesOne":"1","expensesMany":"%d X","thisMonth":"%s Y",
              "other":"Sonstiges","configTitle":"T","configSubtitle":"S",
              "configCategory":"C","configAll":"A","configHide":"H","configSave":"S",
              "addExpense":"Add","trendDescription":"Trend %s"}}"""
        val assist = WidgetAssist.fromJson(json)
        assertThat(assist?.copy?.displayCategory("Other")).isEqualTo("Sonstiges")
        assertThat(assist?.copy?.expensesToday(3)).isEqualTo("3 X")
    }

    @Test
    fun `partial copy from older app version falls back wholesale`() {
        val json =
            """{"dataVersion":"v","currency":"INR",
              "copy":{"today":"Heute","configCategory":"C"}}"""
        assertThat(WidgetAssist.fromJson(json)?.copy).isNull()
    }

    @Test
    fun `assist without copy yields null copy`() {
        val assist = WidgetAssist.fromJson("""{"dataVersion":"v","currency":"INR"}""")
        assertThat(assist?.copy).isNull()
    }
}
