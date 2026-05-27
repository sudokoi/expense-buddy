package expo.modules.expensebuddylogger

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LogDaoTest {
    private lateinit var db: LoggerDatabase
    private lateinit var dao: LogDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, LoggerDatabase::class.java).build()
        dao = db.logDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun `insert and retrieve last entries`() =
        runTest {
            dao.insert(entry("DEBUG", "TEST", "message 1"))
            dao.insert(entry("INFO", "TEST", "message 2"))

            val entries = dao.getLast(10)
            assertThat(entries).hasSize(2)
            assertThat(entries[0].message).isEqualTo("message 2")
            assertThat(entries[1].message).isEqualTo("message 1")
        }

    @Test
    fun `getLast respects limit`() =
        runTest {
            dao.insert(entry("DEBUG", "TEST", "msg 1"))
            dao.insert(entry("DEBUG", "TEST", "msg 2"))
            dao.insert(entry("DEBUG", "TEST", "msg 3"))

            val entries = dao.getLast(2)
            assertThat(entries).hasSize(2)
        }

    @Test
    fun `getLastByLevel filters by level`() =
        runTest {
            dao.insert(entry("DEBUG", "TEST", "debug msg"))
            dao.insert(entry("ERROR", "TEST", "error msg"))

            val errors = dao.getLastByLevel("ERROR", 10)
            assertThat(errors).hasSize(1)
            assertThat(errors[0].level).isEqualTo("ERROR")
        }

    @Test
    fun `count returns number of entries`() =
        runTest {
            dao.insert(entry("INFO", "TEST", "msg 1"))
            dao.insert(entry("INFO", "TEST", "msg 2"))

            assertThat(dao.count()).isEqualTo(2)
        }

    @Test
    fun `prune removes oldest entries`() =
        runTest {
            dao.insert(entry("DEBUG", "TEST", "oldest", timestamp = 100L))
            dao.insert(entry("DEBUG", "TEST", "middle", timestamp = 200L))
            dao.insert(entry("DEBUG", "TEST", "newest", timestamp = 300L))

            dao.prune(2)

            val remaining = dao.getLast(10)
            assertThat(remaining).hasSize(2)
            assertThat(remaining[0].message).isEqualTo("newest")
            assertThat(remaining[1].message).isEqualTo("middle")
        }

    @Test
    fun `clearAll removes all entries`() =
        runTest {
            dao.insert(entry("INFO", "TEST", "msg"))
            dao.clearAll()

            assertThat(dao.count()).isEqualTo(0)
        }

    private fun entry(
        level: String,
        tag: String,
        message: String,
        timestamp: Long = 1000L,
    ): LogEntity =
        LogEntity(
            timestamp = timestamp,
            level = level,
            tag = tag,
            message = message,
            stacktrace = null,
        )
}
