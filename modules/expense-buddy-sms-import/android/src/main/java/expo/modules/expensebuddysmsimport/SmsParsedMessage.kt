package expo.modules.expensebuddysmsimport

data class SmsRawMessage(
    val messageId: String,
    val sender: String,
    val body: String,
    val receivedAt: String,
)

data class SmsPaymentMethod(
    val type: String,
    val identifier: String? = null,
    val instrumentId: String? = null,
)

data class SmsParsedMessage(
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
)
