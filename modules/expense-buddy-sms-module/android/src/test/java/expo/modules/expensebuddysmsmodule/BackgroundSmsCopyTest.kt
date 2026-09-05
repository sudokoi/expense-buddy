package expo.modules.expensebuddysmsmodule

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BackgroundSmsCopyTest {
    @Test
    @Config(qualifiers = "hi")
    fun `Hindi notifications resolve native locale keys`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertThat(context.getString(R.string.sms_notification_channel)).isEqualTo("लेनदेन सूचनाएं")
        assertThat(context.resources.getQuantityString(R.plurals.sms_notification_pending, 2, 2)).contains("2")
    }

    @Test
    @Config(qualifiers = "ja")
    fun `Japanese notifications resolve native locale keys`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertThat(context.getString(R.string.sms_notification_title_one)).isEqualTo("取引をインポートできます")
        assertThat(context.resources.getQuantityString(R.plurals.sms_notification_pending, 2, 2)).isEqualTo("2件の SMS 取引を確認できます。")
    }
}
