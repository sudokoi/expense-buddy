package expo.modules.expensebuddybackgroundsms.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sms_review_queue")
data class ReviewQueueEntity(
    @PrimaryKey
    val fingerprint: String,

    val sender: String,
    val body: String,
    val amount: Double?,
    val amountNormalized: String,
    val timestamp: Long,

    val sourceMessageId: String,
    val sourceReceivedAt: String,

    val status: String,

    val currency: String?,
    val merchantName: String?,
    val categorySuggestion: String?,
    val categorySuggestionConfidence: Double?,
    val categorySuggestionModelId: String?,
    val categorySuggestionSource: String?,
    val paymentMethodType: String?,
    val paymentMethodIdentifier: String?,
    val paymentMethodInstrumentId: String?,
    val noteSuggestion: String?,
    val transactionDate: String?,
    val matchedLocale: String?,
    val matchedPatternKey: String?,
    val acceptedExpenseId: String?,

    val importSource: String,

    val createdAt: Long,
    val updatedAt: Long,
)
