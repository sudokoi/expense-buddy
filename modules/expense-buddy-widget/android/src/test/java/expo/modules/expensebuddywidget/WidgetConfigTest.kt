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
