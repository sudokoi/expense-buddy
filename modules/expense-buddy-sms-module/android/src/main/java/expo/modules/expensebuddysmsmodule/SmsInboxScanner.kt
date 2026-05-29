package expo.modules.expensebuddysmsmodule

import android.content.Context
import android.provider.Telephony
import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.expensebuddysmsparser.CategoryClassifier
import expo.modules.expensebuddysmsparser.SmsCategoryPredictionRequest
import expo.modules.expensebuddysmsparser.SmsCategoryPredictionResult
import expo.modules.expensebuddysmsparser.SmsMessageParser
import expo.modules.expensebuddysmsparser.SmsParsedMessage
import java.time.Instant

class SmsInboxScanner(
    private val context: Context,
) {
    fun scanAndParseMessages(
        sinceTimestampMillis: Long,
        limit: Int? = null,
        classifier: CategoryClassifier? = null,
        useMlOnly: Boolean = false,
    ): List<Map<String, Any?>> {
        val rawMessages = queryRecentMessages(sinceTimestampMillis, limit)
        LoggerApi.d("SMS_MODULE", "scanAndParseMessages: scanned=${rawMessages.size}")

        val parsedList = mutableListOf<Pair<Map<String, String>, SmsParsedMessage>>()
        for (msg in rawMessages) {
            val sender = msg["sender"] ?: continue
            val body = msg["body"] ?: ""
            val receivedAt = msg["receivedAt"] ?: continue
            val messageId = msg["messageId"] ?: continue

            val parseResult = SmsMessageParser.parseRawMessageWithReason(sender, body, receivedAt)
            val parsed = parseResult.parsed

            if (parsed == null) {
                LoggerApi.d("SMS_MODULE", "scanAndParseMessages: skipped message=$messageId reason=${parseResult.skipReason}")
                continue
            }

            parsedList.add(msg to parsed)
        }

        val mlPredictions = mutableMapOf<String, SmsCategoryPredictionResult>()
        if (classifier != null && parsedList.isNotEmpty()) {
            val requests =
                parsedList.map { (msg, parsed) ->
                    SmsCategoryPredictionRequest(
                        messageId = msg["messageId"] ?: "",
                        sender = msg["sender"] ?: "",
                        body = msg["body"] ?: "",
                        merchantName = parsed.merchantName,
                    )
                }
            for (prediction in classifier.classify(requests)) {
                mlPredictions[prediction.messageId] = prediction
            }
            LoggerApi.d("SMS_MODULE", "scanAndParseMessages: ml_classified=${mlPredictions.size}")
        }

        val results =
            parsedList.map { (msg, parsed) ->
                val messageId = msg["messageId"] ?: ""
                val prediction = mlPredictions[messageId]
                val useMlCategory =
                    if (useMlOnly) {
                        prediction != null
                    } else {
                        prediction?.shouldUsePrediction == true
                    }

                mapOf(
                    "fingerprint" to parsed.fingerprint,
                    "messageId" to messageId,
                    "sender" to msg["sender"],
                    "body" to msg["body"],
                    "receivedAt" to msg["receivedAt"],
                    "amount" to parsed.amount,
                    "currency" to parsed.currency,
                    "merchantName" to parsed.merchantName,
                    "categorySuggestion" to if (useMlCategory) prediction!!.category else parsed.categorySuggestion,
                    "categorySuggestionSource" to if (useMlCategory) "ml" else "regex",
                    "categorySuggestionConfidence" to if (useMlCategory) prediction!!.confidence else null,
                    "categorySuggestionModelId" to if (useMlCategory) prediction!!.modelId else null,
                    "paymentMethodType" to parsed.paymentMethodSuggestion?.type,
                    "paymentMethodIdentifier" to parsed.paymentMethodSuggestion?.identifier,
                    "paymentMethodInstrumentId" to parsed.paymentMethodSuggestion?.instrumentId,
                    "noteSuggestion" to parsed.noteSuggestion,
                    "transactionDate" to parsed.transactionDate,
                    "matchedLocale" to parsed.matchedLocale,
                    "matchedPatternKey" to parsed.matchedPatternKey,
                )
            }

        LoggerApi.d("SMS_MODULE", "scanAndParseMessages: parsed=${results.size}")
        return results
    }

    private fun queryRecentMessages(
        sinceTimestampMillis: Long,
        limit: Int?,
    ): List<Map<String, String>> {
        val contentResolver = context.contentResolver
        val resultLimit = resolveLimit(limit)
        val projection =
            arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
            )
        val sortOrder = "${Telephony.Sms.DATE} DESC, ${Telephony.Sms._ID} DESC"
        val messages = mutableListOf<Map<String, String>>()

        contentResolver
            .query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                "${Telephony.Sms.DATE} > ?",
                arrayOf(sinceTimestampMillis.toString()),
                sortOrder,
            )?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressColumn = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyColumn = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateColumn = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)

                while (cursor.moveToNext()) {
                    if (resultLimit != null && messages.size >= resultLimit) {
                        break
                    }

                    val messageId = cursor.getLong(idColumn).toString()
                    val sender = cursor.getString(addressColumn).orEmpty()
                    val body = cursor.getString(bodyColumn).orEmpty()
                    val receivedAt = Instant.ofEpochMilli(cursor.getLong(dateColumn)).toString()

                    messages.add(
                        mapOf(
                            "messageId" to messageId,
                            "sender" to sender,
                            "body" to body,
                            "receivedAt" to receivedAt,
                        ),
                    )
                }
            }

        return messages
    }

    private fun resolveLimit(limit: Int?): Int? {
        if (limit == null) {
            return null
        }

        if (limit <= 0) {
            throw IllegalArgumentException("limit must be greater than 0 when provided.")
        }

        return limit
    }
}
