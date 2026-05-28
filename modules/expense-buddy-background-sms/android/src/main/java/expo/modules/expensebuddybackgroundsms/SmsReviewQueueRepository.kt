package expo.modules.expensebuddybackgroundsms

import android.content.Context
import expo.modules.expensebuddybackgroundsms.db.ImportJournalDao
import expo.modules.expensebuddybackgroundsms.db.ImportJournalEntity
import expo.modules.expensebuddybackgroundsms.db.ReviewQueueDao
import expo.modules.expensebuddybackgroundsms.db.ReviewQueueEntity
import expo.modules.expensebuddybackgroundsms.db.SmsReviewQueueDatabase
import expo.modules.expensebuddylogger.LoggerApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant

private const val STATUS_PENDING = "PENDING"
private const val STATUS_APPROVED = "APPROVED"
private const val STATUS_REJECTED = "REJECTED"
private const val STATUS_DISMISSED = "DISMISSED"
private const val STATUS_FAILED = "FAILED"

class SmsReviewQueueRepository(
    private val context: Context? = null,
    private val injectedDao: ReviewQueueDao? = null,
    private val injectedJournalDao: ImportJournalDao? = null,
) {
    init {
        require(injectedDao != null || context != null) {
            "SmsReviewQueueRepository requires either a Context or an injected ReviewQueueDao"
        }
    }

    private val mutex = Mutex()
    private val dbInstance by lazy { context?.let { SmsReviewQueueDatabase.getInstance(it) } }
    private val dao get() = injectedDao ?: dbInstance!!.reviewQueueDao()
    private val journalDao get() = injectedJournalDao ?: dbInstance!!.importJournalDao()

    suspend fun upsertItem(
        item: ReviewQueueEntity,
        source: String,
    ): Boolean {
        return mutex.withLock {
            val existing = dao.getItemByFingerprint(item.fingerprint)
            if (existing != null) {
                LoggerApi.d("SMS_QUEUE", "DEDUPED fingerprint=${item.fingerprint} source=$source status=${existing.status}")
                journalDao.insert(
                    ImportJournalEntity(
                        fingerprint = item.fingerprint,
                        source = source,
                        action = "DEDUPED",
                        timestamp = System.currentTimeMillis(),
                        details = "existing_status=${existing.status}",
                    ),
                )
                return@withLock false
            }

            val inserted = dao.insertIfNotExists(item)
            if (inserted == -1L) {
                LoggerApi.d("SMS_QUEUE", "DEDUPED fingerprint=${item.fingerprint} source=$source reason=race_condition_insert_failed")
                journalDao.insert(
                    ImportJournalEntity(
                        fingerprint = item.fingerprint,
                        source = source,
                        action = "DEDUPED",
                        timestamp = System.currentTimeMillis(),
                        details = "race_condition_insert_failed",
                    ),
                )
                return@withLock false
            }

            LoggerApi.d("SMS_QUEUE", "INSERTED fingerprint=${item.fingerprint} source=$source")
            journalDao.insert(
                ImportJournalEntity(
                    fingerprint = item.fingerprint,
                    source = source,
                    action = "INSERTED",
                    timestamp = System.currentTimeMillis(),
                    details = null,
                ),
            )
            true
        }
    }

    suspend fun approveItem(
        fingerprint: String,
        source: String,
        expenseId: String? = null,
    ) {
        mutex.withLock {
            val now = System.currentTimeMillis()
            dao.approveItem(fingerprint, STATUS_APPROVED, expenseId, now)
            LoggerApi.d("SMS_QUEUE", "APPROVED fingerprint=$fingerprint source=$source${expenseId?.let { " expense_id=$it" } ?: ""}")
            journalDao.insert(
                ImportJournalEntity(
                    fingerprint = fingerprint,
                    source = source,
                    action = "APPROVED",
                    timestamp = now,
                    details = expenseId?.let { "expense_id=$it" },
                ),
            )
        }
    }

    suspend fun rejectItem(
        fingerprint: String,
        source: String,
    ) {
        mutex.withLock {
            val now = System.currentTimeMillis()
            dao.updateStatus(fingerprint, STATUS_REJECTED, now)
            LoggerApi.d("SMS_QUEUE", "REJECTED fingerprint=$fingerprint source=$source")
            journalDao.insert(
                ImportJournalEntity(
                    fingerprint = fingerprint,
                    source = source,
                    action = "REJECTED",
                    timestamp = now,
                    details = null,
                ),
            )
        }
    }

    suspend fun dismissItem(
        fingerprint: String,
        source: String,
    ) {
        mutex.withLock {
            val now = System.currentTimeMillis()
            dao.updateStatus(fingerprint, STATUS_DISMISSED, now)
            LoggerApi.d("SMS_QUEUE", "DISMISSED fingerprint=$fingerprint source=$source")
            journalDao.insert(
                ImportJournalEntity(
                    fingerprint = fingerprint,
                    source = source,
                    action = "DISMISSED",
                    timestamp = now,
                    details = null,
                ),
            )
        }
    }

    suspend fun getPendingItems(): List<ReviewQueueEntity> = dao.getPendingItems()

    fun observePendingItems(): Flow<List<ReviewQueueEntity>> = dao.observePendingItems()

    suspend fun countPending(): Int = dao.countPending()

    fun toReviewQueueEntity(
        item: BackgroundSmsReviewItem,
        importSource: String,
    ): ReviewQueueEntity {
        val timestamp =
            try {
                Instant.parse(item.sourceMessage.receivedAt).toEpochMilli()
            } catch (_: Exception) {
                System.currentTimeMillis()
            }

        return ReviewQueueEntity(
            fingerprint = item.fingerprint,
            sender = item.sourceMessage.sender,
            body = item.sourceMessage.body,
            amount = item.amount,
            amountNormalized = item.amount?.let { String.format("%.2f", it) } ?: "",
            timestamp = timestamp,
            sourceMessageId = item.sourceMessage.messageId,
            sourceReceivedAt = item.sourceMessage.receivedAt,
            status = STATUS_PENDING,
            currency = item.currency,
            merchantName = item.merchantName,
            categorySuggestion = item.categorySuggestion,
            categorySuggestionConfidence = null,
            categorySuggestionModelId = null,
            categorySuggestionSource = null,
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
