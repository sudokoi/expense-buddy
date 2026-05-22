package expo.modules.expensebuddybackgroundsms

data class BackgroundSmsRawMessage(
  val messageId: String,
  val sender: String,
  val body: String,
  val receivedAt: String,
)

data class BackgroundSmsPaymentMethod(
  val type: String,
  val identifier: String? = null,
  val instrumentId: String? = null,
)

data class BackgroundSmsReviewItem(
  val id: String,
  val fingerprint: String,
  val sourceMessage: BackgroundSmsRawMessage,
  val amount: Double? = null,
  val currency: String? = null,
  val merchantName: String? = null,
  val categorySuggestion: String? = null,
  val paymentMethodSuggestion: BackgroundSmsPaymentMethod? = null,
  val noteSuggestion: String? = null,
  val transactionDate: String? = null,
  val matchedLocale: String? = null,
  val matchedPatternKey: String? = null,
  val status: String = "pending",
  val acceptedExpenseId: String? = null,
  val createdAt: String,
  val updatedAt: String,
)

data class BackgroundSmsReviewQueueSnapshot(
  val items: List<BackgroundSmsReviewItem>,
  val lastScanCursor: String? = null,
  val bootstrapCompletedAt: String? = null,
)

data class BackgroundSmsState(
  val enabled: Boolean,
)

data class BackgroundSmsUpsertResult(
  val snapshot: BackgroundSmsReviewQueueSnapshot,
  val inserted: Boolean,
)
