package expo.modules.expensebuddysmsmodule

import expo.modules.expensebuddysmsparser.SmsPaymentMethod
import expo.modules.expensebuddysmsparser.SmsRawMessage

data class BackgroundSmsReviewItem(
    val id: String,
    val fingerprint: String,
    val sourceMessage: SmsRawMessage,
    val amount: Double? = null,
    val currency: String? = null,
    val merchantName: String? = null,
    val categorySuggestion: String? = null,
    val paymentMethodSuggestion: SmsPaymentMethod? = null,
    val noteSuggestion: String? = null,
    val transactionDate: String? = null,
    val matchedLocale: String? = null,
    val matchedPatternKey: String? = null,
    val status: String = "pending",
    val acceptedExpenseId: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

data class BackgroundSmsState(
    val enabled: Boolean,
)
