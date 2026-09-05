package expo.modules.expensebuddysmsmodule

import com.google.common.truth.Truth.assertThat
import expo.modules.expensebuddysmsparser.SmsRawMessage
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class SmsInboxScannerTest {
    @Test
    fun `non-matches advance progress across equal timestamps and full pages`() =
        runTest {
            val now = Instant.parse("2026-09-05T12:00:00Z").toEpochMilli()
            val timestamp = now - 1000
            val source =
                SmsInboxSource { position, _, limit ->
                    val ids =
                        (1L..501L)
                            .filter { timestamp > position.timestamp || timestamp == position.timestamp && it > position.messageId }
                            .take(
                                limit,
                            )
                    SmsInboxPage(
                        ids.map {
                            SmsRawMessage(it.toString(), "INFO", "Welcome to our store", Instant.ofEpochMilli(timestamp).toString())
                        },
                        ids.lastOrNull()?.let { SmsScanPosition(timestamp, it) },
                    )
                }
            val scanner = SmsInboxScanner(source)
            val first = scanner.scan(null, now, "IN", classifier = { error("No classifier should load for non-matches") })
            assertThat(first.items).isEmpty()
            assertThat(first.position).isEqualTo(SmsScanPosition(timestamp, 500))
            val second = scanner.scan(first.position, now, "IN")
            assertThat(second.position).isEqualTo(SmsScanPosition(timestamp, 501))
            assertThat(scanner.scan(second.position, now, "IN").position).isNull()
        }

    @Test
    fun `expired progress is clamped to the recent window`() =
        runTest {
            val now = 1_800_000_000_000L
            var start: SmsScanPosition? = null
            val scanner =
                SmsInboxScanner(
                    SmsInboxSource { position, _, _ ->
                        start = position
                        SmsInboxPage(emptyList(), null)
                    },
                )
            scanner.scan(SmsScanPosition(0, 999), now, "IN")
            assertThat(start).isEqualTo(SmsScanPosition(now - 604800000, -1))
        }
}
