package expo.modules.expensebuddysmsmodule

import android.content.Context
import android.os.CancellationSignal
import android.provider.Telephony
import expo.modules.expensebuddysmsparser.CategoryClassifier
import expo.modules.expensebuddysmsparser.SmsCategoryPredictionRequest
import expo.modules.expensebuddysmsparser.SmsMessageParser
import expo.modules.expensebuddysmsparser.SmsRawMessage
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant

data class SmsScanPosition(
    val timestamp: Long,
    val messageId: Long,
)

data class SmsInboxPage(
    val messages: List<SmsRawMessage>,
    val position: SmsScanPosition?,
)

data class SmsScanPage(
    val items: List<BackgroundSmsReviewItem>,
    val position: SmsScanPosition?,
)

/** Pages are oldest-first so committing a position never jumps over an unread row. */
fun interface SmsInboxSource {
    suspend fun readAfter(
        position: SmsScanPosition,
        until: Long,
        limit: Int,
    ): SmsInboxPage
}

class AndroidSmsInboxSource(
    private val context: Context,
) : SmsInboxSource {
    override suspend fun readAfter(
        position: SmsScanPosition,
        until: Long,
        limit: Int,
    ): SmsInboxPage =
        withContext(Dispatchers.IO) {
            require(limit in 1..500)
            val messages = mutableListOf<SmsRawMessage>()
            var next: SmsScanPosition? = null
            val id = Telephony.Sms._ID
            val date = Telephony.Sms.DATE
            currentCoroutineContext().ensureActive()
            val signal = CancellationSignal()
            val cancellation =
                launch(start = CoroutineStart.UNDISPATCHED) {
                    try {
                        awaitCancellation()
                    } finally {
                        signal.cancel()
                    }
                }
            try {
                context.contentResolver
                    .query(
                        Telephony.Sms.Inbox.CONTENT_URI,
                        arrayOf(id, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, date),
                        "($date > ? OR ($date = ? AND $id > ?)) AND $date <= ?",
                        arrayOf(
                            position.timestamp.toString(),
                            position.timestamp.toString(),
                            position.messageId.toString(),
                            until.toString(),
                        ),
                        "$date ASC, $id ASC",
                        signal,
                    )?.use { cursor ->
                        while (messages.size < limit && cursor.moveToNext()) {
                            currentCoroutineContext().ensureActive()
                            val timestamp = cursor.getLong(3)
                            val messageId = cursor.getLong(0)
                            messages.add(
                                SmsRawMessage(
                                    messageId.toString(),
                                    cursor.getString(1).orEmpty(),
                                    cursor.getString(2).orEmpty(),
                                    Instant.ofEpochMilli(timestamp).toString(),
                                ),
                            )
                            next = SmsScanPosition(timestamp, messageId)
                        }
                    }
            } finally {
                cancellation.cancel()
            }
            SmsInboxPage(messages, next)
        }
}

/** Typed native pipeline: progress includes non-matches; only candidates enter Room. */
class SmsInboxScanner(
    private val source: SmsInboxSource,
) {
    constructor(context: Context) : this(AndroidSmsInboxSource(context.applicationContext))

    suspend fun scan(
        position: SmsScanPosition?,
        until: Long,
        region: String,
        useMlOnly: Boolean = false,
        classifier: () -> CategoryClassifier? = { null },
    ): SmsScanPage {
        val floor = SmsScanPosition(until - 7L * 24 * 60 * 60 * 1000, -1)
        val start = position?.takeIf { it.timestamp in floor.timestamp..until } ?: floor
        val page = source.readAfter(start, until, 500)
        return withContext(Dispatchers.Default) {
            val rules = SmsMessageParser.resolveRulePack(region)
            val parsed =
                page.messages.mapNotNull { raw ->
                    currentCoroutineContext().ensureActive()
                    SmsMessageParser.parseRawMessageWithReason(raw.sender, raw.body, raw.receivedAt, rules).parsed?.let { raw to it }
                }
            val model = if (parsed.isEmpty()) null else classifier()
            val now = Instant.ofEpochMilli(until).toString()
            val items =
                parsed.map { (raw, result) ->
                    currentCoroutineContext().ensureActive()
                    // Yield cancellation between inferences; Interpreter is a blocking call.
                    val prediction =
                        model
                            ?.classify(
                                listOf(SmsCategoryPredictionRequest(raw.messageId, raw.sender, raw.body, result.merchantName)),
                            )?.firstOrNull()
                    val usePrediction = prediction != null && (useMlOnly || prediction.shouldUsePrediction)
                    BackgroundSmsReviewItem(
                        id = "${result.fingerprint}_${raw.messageId}",
                        fingerprint = result.fingerprint,
                        sourceMessage = raw,
                        amount = result.amount,
                        currency = result.currency,
                        merchantName = result.merchantName,
                        categorySuggestion = if (usePrediction) prediction!!.category else result.categorySuggestion,
                        categorySuggestionSource = if (usePrediction) "ml" else "regex",
                        categorySuggestionConfidence = if (usePrediction) prediction!!.confidence else null,
                        categorySuggestionModelId = if (usePrediction) prediction!!.modelId else null,
                        paymentMethodSuggestion = result.paymentMethodSuggestion,
                        noteSuggestion = result.noteSuggestion,
                        transactionDate = result.transactionDate,
                        matchedLocale = result.matchedLocale,
                        matchedPatternKey = result.matchedPatternKey,
                        createdAt = now,
                        updatedAt = now,
                    )
                }
            SmsScanPage(items, page.position)
        }
    }
}
