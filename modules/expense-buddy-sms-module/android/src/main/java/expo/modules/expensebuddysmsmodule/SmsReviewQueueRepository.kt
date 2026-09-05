package expo.modules.expensebuddysmsmodule

import android.content.Context
import androidx.room.withTransaction
import expo.modules.expensebuddysmsmodule.db.ImportJournalEntity
import expo.modules.expensebuddysmsmodule.db.ReviewQueueEntity
import expo.modules.expensebuddysmsmodule.db.SmsReviewQueueDatabase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Instant
import java.util.Locale

/** Every mutation, including its journal, commits atomically through the same database. */
class SmsReviewQueueRepository(
    private val db: SmsReviewQueueDatabase,
) {
    constructor(context: Context) : this(SmsReviewQueueDatabase.getInstance(context))

    private val dao get() = db.reviewQueueDao()
    private val journal get() = db.importJournalDao()

    suspend fun upsertItems(
        items: List<ReviewQueueEntity>,
        source: String,
    ): Int =
        db.withTransaction {
            var inserted = 0
            for (item in items) {
                val added = dao.insertIfNotExists(item) != -1L
                if (added) inserted++
                journal.insert(
                    ImportJournalEntity(
                        fingerprint = item.fingerprint,
                        source = source,
                        action = if (added) "INSERTED" else "DEDUPED",
                        timestamp = System.currentTimeMillis(),
                        details = null,
                    ),
                )
            }
            inserted
        }

    suspend fun upsertItem(
        item: ReviewQueueEntity,
        source: String,
    ): Boolean = upsertItems(listOf(item), source) == 1

    suspend fun approveItem(
        fingerprint: String,
        source: String,
        expenseId: String? = null,
    ) = resolveItems(listOf(fingerprint), source, "APPROVED", expenseId)

    suspend fun rejectItem(
        fingerprint: String,
        source: String,
    ) = rejectItems(listOf(fingerprint), source)

    suspend fun dismissItem(
        fingerprint: String,
        source: String,
    ) = dismissItems(listOf(fingerprint), source)

    suspend fun approveItems(
        fingerprints: List<String>,
        source: String,
    ) = resolveItems(fingerprints, source, "APPROVED")

    suspend fun rejectItems(
        fingerprints: List<String>,
        source: String,
    ) = resolveItems(fingerprints, source, "REJECTED")

    suspend fun dismissItems(
        fingerprints: List<String>,
        source: String,
    ) = resolveItems(fingerprints, source, "DISMISSED")

    private suspend fun resolveItems(
        fingerprints: List<String>,
        source: String,
        status: String,
        expenseId: String? = null,
    ) {
        db.withTransaction {
            val now = System.currentTimeMillis()
            for (fingerprint in fingerprints.distinct()) {
                val item = dao.getItemByFingerprint(fingerprint) ?: continue
                if (item.status != "PENDING") continue
                if (status == "APPROVED") {
                    dao.approveItem(fingerprint, status, expenseId, now)
                } else {
                    dao.updateStatus(fingerprint, status, now)
                }
                journal.insert(
                    ImportJournalEntity(
                        fingerprint = fingerprint,
                        source = source,
                        action = status,
                        timestamp = now,
                        details = expenseId?.let { "expense_id=$it" },
                    ),
                )
            }
        }
    }

    suspend fun getPendingItems(): List<ReviewQueueEntity> = dao.getPendingItems()

    suspend fun countPending(): Int = dao.countPending()

    /** Invalidation includes same-count edits without materializing SMS bodies. */
    fun observeChanges(): Flow<Unit> = db.invalidationTracker.createFlow("sms_review_queue").map { }

    fun toReviewQueueEntity(
        item: BackgroundSmsReviewItem,
        importSource: String,
    ): ReviewQueueEntity {
        val timestamp =
            try {
                Instant.parse(item.sourceMessage.receivedAt).toEpochMilli()
            } catch (
                _: Exception,
            ) {
                System.currentTimeMillis()
            }
        return ReviewQueueEntity(
            fingerprint = item.fingerprint,
            sender = item.sourceMessage.sender,
            body = item.sourceMessage.body,
            amount = item.amount,
            amountNormalized = item.amount?.let { String.format(Locale.ROOT, "%.2f", it) } ?: "",
            timestamp = timestamp,
            sourceMessageId = item.sourceMessage.messageId,
            sourceReceivedAt = item.sourceMessage.receivedAt,
            status = "PENDING",
            currency = item.currency,
            merchantName = item.merchantName,
            categorySuggestion = item.categorySuggestion,
            categorySuggestionConfidence = item.categorySuggestionConfidence,
            categorySuggestionModelId = item.categorySuggestionModelId,
            categorySuggestionSource = item.categorySuggestionSource,
            paymentMethodType = item.paymentMethodSuggestion?.type,
            paymentMethodIdentifier = item.paymentMethodSuggestion?.identifier,
            paymentMethodInstrumentId = item.paymentMethodSuggestion?.instrumentId,
            noteSuggestion = item.noteSuggestion,
            transactionDate = item.transactionDate,
            matchedLocale = item.matchedLocale,
            matchedPatternKey = item.matchedPatternKey,
            acceptedExpenseId = null,
            importSource = importSource,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
        )
    }

    companion object {
        const val SOURCE_MANUAL_SCAN = "MANUAL_SCAN"
        const val SOURCE_BOOTSTRAP_SCAN = "BOOTSTRAP_SCAN"
        const val SOURCE_SMS_RECEIVED = "SMS_RECEIVED"
        const val SOURCE_RETRY_JOB = "RETRY_JOB"
        const val SOURCE_JS_ACTION = "JS_ACTION"
    }
}
