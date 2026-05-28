package expo.modules.expensebuddylogger

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LoggerApiTest {
    private lateinit var db: LoggerDatabase
    private lateinit var dao: LogDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, LoggerDatabase::class.java).build()
        dao = db.logDao()
        LoggerApi.resetForTesting()
        LoggerApi.initializeForTesting(dao, capacity = 10)
    }

    @After
    fun tearDown() {
        db.close()
        LoggerApi.resetForTesting()
    }

    @Test
    fun `append d stores debug entry`() =
        runBlocking {
            LoggerApi.d("TEST", "debug message")
            val entries = awaitEntries(1)
            assertThat(entries[0].level).isEqualTo("DEBUG")
            assertThat(entries[0].tag).isEqualTo("TEST")
            assertThat(entries[0].message).isEqualTo("debug message")
        }

    @Test
    fun `append i stores info entry`() =
        runBlocking {
            LoggerApi.i("TEST", "info message")
            val entries = awaitEntries(1)
            assertThat(entries[0].level).isEqualTo("INFO")
        }

    @Test
    fun `append w stores warn entry`() =
        runBlocking {
            LoggerApi.w("TEST", "warn message")
            val entries = awaitEntries(1)
            assertThat(entries[0].level).isEqualTo("WARN")
        }

    @Test
    fun `append e stores error entry with stacktrace`() =
        runBlocking {
            val error = RuntimeException("test error")
            LoggerApi.e("TEST", "error message", error)
            val entries = awaitEntries(1)
            assertThat(entries[0].level).isEqualTo("ERROR")
            assertThat(entries[0].stacktrace).contains("RuntimeException")
            assertThat(entries[0].stacktrace).contains("test error")
        }

    @Test
    fun `multiple entries are stored in order`() =
        runBlocking {
            LoggerApi.d("T1", "first")
            LoggerApi.i("T2", "second")
            LoggerApi.w("T3", "third")
            val entries = awaitEntries(3)
            assertThat(entries[0].message).isEqualTo("third")
            assertThat(entries[1].message).isEqualTo("second")
            assertThat(entries[2].message).isEqualTo("first")
        }

    @Test
    fun `count returns number of entries`() =
        runBlocking {
            LoggerApi.d("T", "msg 1")
            LoggerApi.i("T", "msg 2")
            val entries = awaitEntries(2)
            assertThat(entries).hasSize(2)
        }

    @Test
    fun `prunes oldest entries when over capacity`() =
        runBlocking {
            repeat(15) { index ->
                LoggerApi.d("T", "msg $index")
            }
            awaitCount(10)
            val last = LoggerApi.getLast(10)
            assertThat(last[0].message).isEqualTo("msg 14")
            assertThat(last[9].message).isEqualTo("msg 5")
        }

    @Test
    fun `getLastAsString formats correctly`() =
        runBlocking {
            LoggerApi.d("TAG", "hello")
            awaitEntries(1)
            val output = LoggerApi.getLastAsString(10)
            assertThat(output).contains("[DEBUG]")
            assertThat(output).contains("[TAG]")
            assertThat(output).contains("hello")
        }

    @Test
    fun `getLastAsString includes stacktrace when present`() =
        runBlocking {
            LoggerApi.e("TAG", "failed", RuntimeException("boom"))
            awaitEntries(1)
            val output = LoggerApi.getLastAsString(10)
            assertThat(output).contains("boom")
            assertThat(output).contains("RuntimeException")
        }

    @Test
    fun `clear removes all entries`() =
        runBlocking {
            LoggerApi.d("T", "msg")
            awaitEntries(1)
            assertThat(LoggerApi.count()).isEqualTo(1)
            LoggerApi.clear()
            assertThat(LoggerApi.count()).isEqualTo(0)
        }

    @Test
    fun `getLast respects limit`() =
        runBlocking {
            repeat(5) { LoggerApi.d("T", "msg $it") }
            awaitEntries(5)
            val entries = LoggerApi.getLast(3)
            assertThat(entries).hasSize(3)
        }

    @Test
    fun `getLastAsString with no entries returns empty`() =
        runBlocking {
            assertThat(LoggerApi.getLastAsString(10)).isEmpty()
        }

    private suspend fun awaitEntries(minCount: Int): List<LogEntity> {
        val deadline = System.currentTimeMillis() + 5_000
        var entries = LoggerApi.getLast(minCount)
        while (entries.size < minCount && System.currentTimeMillis() < deadline) {
            delay(50)
            entries = LoggerApi.getLast(minCount)
        }
        return entries
    }

    private suspend fun awaitCount(target: Int) {
        val deadline = System.currentTimeMillis() + 5_000
        var count = LoggerApi.count()
        while (count != target && System.currentTimeMillis() < deadline) {
            delay(50)
            count = LoggerApi.count()
        }
    }
}
