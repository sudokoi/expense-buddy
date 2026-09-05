package expo.modules.expensebuddylogger

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LogWriterTest {
    @Test
    fun `overflow is bounded favors warnings and records losses`() =
        runTest {
            val context = ApplicationProvider.getApplicationContext<Context>()
            val db = Room.inMemoryDatabaseBuilder(context, LoggerDatabase::class.java).build()
            try {
                val dao = db.logDao()
                val writer = LogWriter(dao, capacity = 10, queueCapacity = 3)
                writer.enqueue(entry("WARN", "keep"))
                repeat(1000) { writer.enqueue(entry("DEBUG", "debug-$it")) }
                writer.flush()
                val logs = dao.getLast(10)
                assertThat(logs).hasSize(4)
                assertThat(
                    logs.map { it.message },
                ).containsAtLeast("keep", "debug-998", "debug-999", "Dropped 998 queued entries under load")
                writer.enqueue(entry("ERROR", "clear me"))
                writer.clear()
                writer.flush()
                assertThat(dao.count()).isEqualTo(0)
            } finally {
                db.close()
            }
        }

    @Test
    fun `batches enforce the stored cap without per-entry counts`() =
        runTest {
            val context = ApplicationProvider.getApplicationContext<Context>()
            val db = Room.inMemoryDatabaseBuilder(context, LoggerDatabase::class.java).build()
            try {
                val writer = LogWriter(db.logDao(), capacity = 10)
                repeat(200) { writer.enqueue(entry("INFO", "$it")) }
                writer.flush()
                assertThat(db.logDao().count()).isEqualTo(10)
                assertThat(db.logDao().getLast(10).map { it.message }).containsExactlyElementsIn((190..199).map { "$it" })
            } finally {
                db.close()
            }
        }

    private fun entry(
        level: String,
        message: String,
    ) = LogEntity(timestamp = 1, level = level, tag = "TEST", message = message, stacktrace = null)
}
