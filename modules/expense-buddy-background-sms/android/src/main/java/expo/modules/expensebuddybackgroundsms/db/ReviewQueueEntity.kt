package expo.modules.expensebuddybackgroundsms.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "sms_review_queue",
    indices = [
        Index(value = ["status"]),
        Index(value = ["fingerprint"]),
        Index(value = ["timestamp"]),
    ],
)
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
) {
    fun toDto(): Map<String, Any?> =
        mapOf(
            "fingerprint" to fingerprint,
            "sender" to sender,
            "body" to body,
            "amount" to amount,
            "currency" to currency,
            "merchantName" to merchantName,
            "categorySuggestion" to categorySuggestion,
            "categorySuggestionConfidence" to categorySuggestionConfidence,
            "categorySuggestionModelId" to categorySuggestionModelId,
            "categorySuggestionSource" to categorySuggestionSource,
            "paymentMethodType" to paymentMethodType,
            "paymentMethodIdentifier" to paymentMethodIdentifier,
            "paymentMethodInstrumentId" to paymentMethodInstrumentId,
            "noteSuggestion" to noteSuggestion,
            "transactionDate" to transactionDate,
            "matchedLocale" to matchedLocale,
            "matchedPatternKey" to matchedPatternKey,
            "status" to status,
            "acceptedExpenseId" to acceptedExpenseId,
            "sourceMessageId" to sourceMessageId,
            "sourceReceivedAt" to sourceReceivedAt,
            "createdAt" to createdAt,
            "updatedAt" to updatedAt,
        )
}
