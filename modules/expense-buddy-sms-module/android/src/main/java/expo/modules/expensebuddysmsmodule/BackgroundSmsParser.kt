package expo.modules.expensebuddysmsmodule

import android.telephony.SmsMessage
import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.expensebuddysmsparser.SmsMessageParser
import expo.modules.expensebuddysmsparser.SmsRawMessage
import java.time.Instant

object BackgroundSmsParser {
    private fun toRawMessage(messages: Array<SmsMessage>): SmsRawMessage? {
        if (messages.isEmpty()) {
            return null
        }

        val first = messages.first()
        val sender = first.displayOriginatingAddress.orEmpty()
        val body =
            messages
                .joinToString(separator = "") { message ->
                    message.displayMessageBody.orEmpty()
                }.trim()
        if (body.isBlank()) {
            return null
        }

        val timestampMillis = first.timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
        val receivedAt = Instant.ofEpochMilli(timestampMillis).toString()
        val messageId = "bg_${SmsMessageParser.createFingerprint(sender, body, receivedAt)}_$timestampMillis"

        return SmsRawMessage(
            messageId = messageId,
            sender = sender,
            body = body,
            receivedAt = receivedAt,
        )
    }

    fun parseIncomingMessage(messages: Array<SmsMessage>): BackgroundSmsReviewItem? {
        val rawMessage = toRawMessage(messages) ?: return null
        val parsed =
            SmsMessageParser.parseRawMessage(
                sender = rawMessage.sender,
                body = rawMessage.body,
                receivedAt = rawMessage.receivedAt,
            )
        if (parsed == null) {
            LoggerApi.d("SMS_PARSER", "Skipped message from ${rawMessage.sender}: did not match transaction pattern")
            return null
        }

        LoggerApi.d("SMS_PARSER", "Parsed: fingerprint=${parsed.fingerprint} amount=${parsed.amount} merchant=${parsed.merchantName}")

        val now = Instant.now().toString()
        return BackgroundSmsReviewItem(
            id = "${parsed.fingerprint}_${rawMessage.messageId}",
            fingerprint = parsed.fingerprint,
            sourceMessage = rawMessage,
            amount = parsed.amount,
            currency = parsed.currency,
            merchantName = parsed.merchantName,
            categorySuggestion = parsed.categorySuggestion,
            paymentMethodSuggestion = parsed.paymentMethodSuggestion,
            noteSuggestion = parsed.noteSuggestion,
            transactionDate = parsed.transactionDate,
            matchedLocale = parsed.matchedLocale,
            matchedPatternKey = parsed.matchedPatternKey,
            status = "pending",
            createdAt = now,
            updatedAt = now,
        )
    }
}
