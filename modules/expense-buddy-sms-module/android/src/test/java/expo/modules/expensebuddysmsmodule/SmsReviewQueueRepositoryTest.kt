package expo.modules.expensebuddysmsmodule

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import expo.modules.expensebuddysmsmodule.db.ReviewQueueEntity
import expo.modules.expensebuddysmsmodule.db.SmsReviewQueueDatabase
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
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
        repo =
            SmsReviewQueueRepository(
                injectedDao = db.reviewQueueDao(),
                injectedJournalDao = db.importJournalDao(),
            )
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

            val items = repo.observePendingItems().first()
            assertThat(items).hasSize(1)
        }

    @Test
    fun `concurrent upserts deduplicate correctly`() =
        runTest {
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_MANUAL_SCAN)
            repo.upsertItem(entity("fp1"), SmsReviewQueueRepository.SOURCE_SMS_RECEIVED)

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
