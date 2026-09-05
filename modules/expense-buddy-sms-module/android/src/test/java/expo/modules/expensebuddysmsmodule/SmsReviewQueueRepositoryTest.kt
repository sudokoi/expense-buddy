package expo.modules.expensebuddysmsmodule

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import expo.modules.expensebuddysmsmodule.db.ReviewQueueEntity
import expo.modules.expensebuddysmsmodule.db.SmsReviewQueueDatabase
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SmsReviewQueueRepositoryTest {
    private lateinit var db: SmsReviewQueueDatabase
    private lateinit var repo: SmsReviewQueueRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, SmsReviewQueueDatabase::class.java).build()
        repo = SmsReviewQueueRepository(db)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun `upsert new item returns true and persists`() =
        runTest {
            val inserted = repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)

            assertThat(inserted).isTrue()
            val pending = repo.getPendingItems()
            assertThat(pending).hasSize(1)
            assertThat(pending[0].fingerprint).isEqualTo("fp1")
        }

    @Test
    fun `upsert duplicate item returns false`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)
            val inserted = repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_SMS_RECEIVED)

            assertThat(inserted).isFalse()
            assertThat(repo.getPendingItems()).hasSize(1)
        }

    @Test
    fun `approve item changes status`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)
            repo.approveItem("fp1", SmsReviewQueueRepository.SOURCE_JS_ACTION, "expense_123")

            val items = repo.getPendingItems()
            assertThat(items).isEmpty()
            assertThat(repo.countPending()).isEqualTo(0)
        }

    @Test
    fun `reject item changes status`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)
            repo.rejectItem("fp1", SmsReviewQueueRepository.SOURCE_JS_ACTION)

            assertThat(repo.countPending()).isEqualTo(0)
        }

    @Test
    fun `dismiss item changes status`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)
            repo.dismissItem("fp1", SmsReviewQueueRepository.SOURCE_JS_ACTION)

            assertThat(repo.countPending()).isEqualTo(0)
        }

    @Test
    fun `observe pending items emits after upsert`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)

            repo.observeChanges().first()
            assertThat(repo.getPendingItems()).hasSize(1)
        }

    @Test
    fun `concurrent upserts deduplicate correctly`() =
        runTest {
            val results = (1..10).map { async { SmsReviewQueueRepository(db).upsertItem(entity("fp1"), "TEST") } }.awaitAll()
            assertThat(results.count { it }).isEqualTo(1)

            assertThat(repo.getPendingItems()).hasSize(1)
        }

    @Test
    fun `multiple pending items are returned`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)
            repo.upsertItem(entity("fp2"), SmsReviewQueueRepository.SOURCE_SMS_RECEIVED)
            repo.upsertItem(entity("fp3"), SmsReviewQueueRepository.SOURCE_SMS_RECEIVED)

            assertThat(repo.getPendingItems()).hasSize(3)
        }

    @Test
    fun `invalidation publishes complete batches and same-count edits`() =
        runBlocking {
            val snapshots = Channel<List<ReviewQueueEntity>>(Channel.UNLIMITED)
            val observer =
                launch {
                    repo.observeChanges().collect { snapshots.send(repo.getPendingItems()) }
                }
            try {
                withTimeout(5000) { assertThat(snapshots.receive()).isEmpty() }
                repo.upsertItems((1..100).map { entity("fp$it") }, "TEST")
                withTimeout(5000) { assertThat(snapshots.receive()).hasSize(100) }
                db.openHelper.writableDatabase.execSQL("UPDATE sms_review_queue SET body = 'edited' WHERE fingerprint = 'fp1'")
                db.invalidationTracker.refreshAsync()
                withTimeout(5000) {
                    val updated = snapshots.receive()
                    assertThat(updated).hasSize(100)
                    assertThat(updated.single { it.fingerprint == "fp1" }.body).isEqualTo("edited")
                }
            } finally {
                observer.cancel()
                snapshots.close()
            }
        }

    @Test
    fun `failed batch journal rolls back every queue insert`() =
        runTest {
            db.openHelper.writableDatabase.execSQL(
                "CREATE TRIGGER reject_journal BEFORE INSERT ON sms_import_journal WHEN NEW.fingerprint = 'fp2' BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
            )
            var failed = false
            try {
                repo.upsertItems(listOf(entity("fp1"), entity("fp2")), "TEST")
            } catch (_: Exception) {
                failed = true
            }
            assertThat(failed).isTrue()
            assertThat(repo.getPendingItems()).isEmpty()
            assertThat(db.importJournalDao().getRecentEntries(10)).isEmpty()
        }

    @Test
    fun `failed bulk approval rolls back all statuses and journals`() =
        runTest {
            repo.upsertItems(listOf(entity("fp1"), entity("fp2")), "TEST")
            db.openHelper.writableDatabase.execSQL(
                "CREATE TRIGGER reject_approval BEFORE INSERT ON sms_import_journal WHEN NEW.fingerprint = 'fp2' AND NEW.action = 'APPROVED' BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
            )
            var failed = false
            try {
                repo.approveItems(listOf("fp1", "fp2"), "TEST")
            } catch (_: Exception) {
                failed = true
            }
            assertThat(failed).isTrue()
            assertThat(repo.getPendingItems()).hasSize(2)
            assertThat(db.importJournalDao().getRecentEntries(10).map { it.action }).containsExactly("INSERTED", "INSERTED")
        }

    @Test
    fun `resolved items are not overwritten by a repeated bulk action`() =
        runTest {
            repo.upsertItems(listOf(entity("fp1"), entity("fp2")), "TEST")
            repo.approveItems(listOf("fp1", "fp1"), "TEST")
            repo.rejectItems(listOf("fp1", "fp2"), "TEST")
            assertThat(db.reviewQueueDao().getItemByFingerprint("fp1")!!.status).isEqualTo("APPROVED")
            assertThat(db.reviewQueueDao().getItemByFingerprint("fp2")!!.status).isEqualTo("REJECTED")
            assertThat(db.importJournalDao().getRecentEntries(10)).hasSize(4)
        }

    private fun entity(fingerprint: String): ReviewQueueEntity =
        ReviewQueueEntity(
            fingerprint = fingerprint,
            sender = "TestBank",
            body = "Your account debited INR 500.00",
            amount = 500.0,
            amountNormalized = "500.00",
            timestamp = 1000L,
            sourceMessageId = "msg_$fingerprint",
            sourceReceivedAt = "2026-01-01T00:00:00Z",
            status = "PENDING",
            currency = null,
            merchantName = null,
            categorySuggestion = null,
            categorySuggestionConfidence = null,
            categorySuggestionModelId = null,
            categorySuggestionSource = null,
            paymentMethodType = null,
            paymentMethodIdentifier = null,
            paymentMethodInstrumentId = null,
            noteSuggestion = null,
            transactionDate = null,
            matchedLocale = null,
            matchedPatternKey = null,
            acceptedExpenseId = null,
            importSource = "TEST",
            createdAt = 1000L,
            updatedAt = 1000L,
        )
}
