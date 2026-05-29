package expo.modules.expensebuddysmsmodule.db

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ReviewQueueDaoTest {
    private lateinit var db: SmsReviewQueueDatabase
    private lateinit var dao: ReviewQueueDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, SmsReviewQueueDatabase::class.java).build()
        dao = db.reviewQueueDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun `insert and query pending items`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))
            dao.insertIfNotExists(entity("fp2"))

            val items = dao.getPendingItems()
            assertThat(items).hasSize(2)
            assertThat(items.map { it.fingerprint }).containsExactly("fp1", "fp2")
        }

    @Test
    fun `insert ignores duplicates`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))
            val result = dao.insertIfNotExists(entity("fp1"))

            assertThat(result).isEqualTo(-1L)
            assertThat(dao.getPendingItems()).hasSize(1)
        }

    @Test
    fun `update status`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))
            dao.updateStatus("fp1", "APPROVED", 2000L)

            val item = dao.getItemByFingerprint("fp1")
            assertThat(item).isNotNull()
            assertThat(item!!.status).isEqualTo("APPROVED")
            assertThat(item.updatedAt).isEqualTo(2000L)
        }

    @Test
    fun `approve item sets status and expense id`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))
            dao.approveItem("fp1", "APPROVED", "expense_123", 3000L)

            val item = dao.getItemByFingerprint("fp1")
            assertThat(item!!.status).isEqualTo("APPROVED")
            assertThat(item.acceptedExpenseId).isEqualTo("expense_123")
        }

    @Test
    fun `count pending returns only pending items`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))
            dao.insertIfNotExists(entity("fp2"))
            dao.updateStatus("fp2", "APPROVED", 1000L)

            assertThat(dao.countPending()).isEqualTo(1)
        }

    @Test
    fun `clear all removes all items`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))
            dao.clearAll()

            assertThat(dao.getPendingItems()).isEmpty()
        }

    @Test
    fun `observe pending items emits on changes`() =
        runTest {
            dao.insertIfNotExists(entity("fp1"))

            val items = dao.observePendingItems().first()
            assertThat(items).hasSize(1)
            assertThat(items[0].fingerprint).isEqualTo("fp1")
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
