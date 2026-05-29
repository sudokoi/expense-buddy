package expo.modules.expensebuddysmsmodule.db

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
class ImportJournalDaoTest {
    private lateinit var db: SmsReviewQueueDatabase
    private lateinit var dao: ImportJournalDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, SmsReviewQueueDatabase::class.java).build()
        dao = db.importJournalDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun `insert and retrieve recent entries`() =
        runTest {
            dao.insert(
                ImportJournalEntity(
                    fingerprint = "fp1",
                    source = "TEST",
                    action = "INSERTED",
                    timestamp = 1000L,
                    details = null,
                ),
            )

            val entries = dao.getRecentEntries(10)
            assertThat(entries).hasSize(1)
            assertThat(entries[0].fingerprint).isEqualTo("fp1")
            assertThat(entries[0].action).isEqualTo("INSERTED")
        }

    @Test
    fun `get entries by fingerprint`() =
        runTest {
            val entry =
                ImportJournalEntity(
                    fingerprint = "fp1",
                    source = "TEST",
                    action = "INSERTED",
                    timestamp = 1000L,
                    details = null,
                )
            dao.insert(entry)

            val entries = dao.getEntriesForFingerprint("fp1")
            assertThat(entries).hasSize(1)
        }

    @Test
    fun `recent entries are ordered by timestamp descending`() =
        runTest {
            dao.insert(ImportJournalEntity(fingerprint = "fp1", source = "TEST", action = "OLD", timestamp = 100L, details = null))
            dao.insert(ImportJournalEntity(fingerprint = "fp2", source = "TEST", action = "NEW", timestamp = 200L, details = null))

            val entries = dao.getRecentEntries(10)
            assertThat(entries[0].action).isEqualTo("NEW")
            assertThat(entries[1].action).isEqualTo("OLD")
        }
}
