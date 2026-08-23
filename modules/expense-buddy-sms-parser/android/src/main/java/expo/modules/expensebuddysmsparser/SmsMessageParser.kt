package expo.modules.expensebuddysmsparser

import android.util.Log
import java.security.MessageDigest
import java.text.Normalizer
import java.time.Instant
import java.util.Locale

enum class SkipReason {
    EMPTY_BODY,
    OTP_MATCH,
    NEGATIVE_ALERT,
    NOT_DEBIT,
    AMOUNT_MISSING,
}

data class ParseResult(
    val parsed: SmsParsedMessage?,
    val skipReason: SkipReason?,
)

object SmsMessageParser {
    private val combiningMarksPattern = Regex("[\\u0300-\\u036f\\ufe20-\\ufe2f]")

    /**
     * Resolves the rule pack for a region code (ISO 3166-1 alpha-2).
     * Unknown or null regions fall back to India — the historical behavior —
     * so absence of a region argument can never change parsing outcomes.
     */
    fun resolveRulePack(regionCode: String?): SmsRulePack =
        when (regionCode?.uppercase(Locale.ROOT)) {
            IndiaSmsRulePack.regionCode -> IndiaSmsRulePack
            else -> IndiaSmsRulePack
        }

    private fun normalizeUnicode(text: String): String =
        try {
            val nfkd = Normalizer.normalize(text, Normalizer.Form.NFKD)
            nfkd.replace(combiningMarksPattern, "")
        } catch (_: Exception) {
            text
        }

    fun parseRawMessage(
        sender: String,
        body: String,
        receivedAt: String,
    ): SmsParsedMessage? = parseRawMessageWithReason(sender, body, receivedAt).parsed

    fun parseRawMessageWithReason(
        sender: String,
        body: String,
        receivedAt: String,
        rulePack: SmsRulePack = resolveRulePack(null),
    ): ParseResult {
        val normalizedBody = normalizeUnicode(body).trim()
        if (normalizedBody.isEmpty()) {
            Log.d("SMS_PARSER", "skip reason=EMPTY_BODY sender=$sender")
            return ParseResult(null, SkipReason.EMPTY_BODY)
        }

        if (rulePack.otpKeywords.containsMatchIn(normalizedBody)) {
            Log.d("SMS_PARSER", "skip reason=OTP_MATCH sender=$sender")
            return ParseResult(null, SkipReason.OTP_MATCH)
        }

        if (isNegativeBankAlert(rulePack, normalizedBody)) {
            Log.d("SMS_PARSER", "skip reason=NEGATIVE_ALERT sender=$sender")
            return ParseResult(null, SkipReason.NEGATIVE_ALERT)
        }

        if (!rulePack.debitKeywords.containsMatchIn(normalizedBody)) {
            Log.d("SMS_PARSER", "skip reason=NOT_DEBIT sender=$sender")
            return ParseResult(null, SkipReason.NOT_DEBIT)
        }

        // Reject pure credit messages (credited/received without any debit signal)
        if (rulePack.creditOnlyKeywords.containsMatchIn(normalizedBody) &&
            !rulePack.settledDebitKeywords.containsMatchIn(normalizedBody)
        ) {
            Log.d("SMS_PARSER", "skip reason=NOT_DEBIT (credit-only) sender=$sender")
            return ParseResult(null, SkipReason.NOT_DEBIT)
        }

        val amount = parseAmount(rulePack, normalizedBody)
        if (amount == null) {
            Log.d("SMS_PARSER", "skip reason=AMOUNT_MISSING sender=$sender")
            return ParseResult(null, SkipReason.AMOUNT_MISSING)
        }
        val merchantName = inferMerchant(rulePack, normalizedBody)

        val messageId = "scan_${sha256("$sender|$body|$receivedAt")}"
        val rawMessage =
            SmsRawMessage(
                messageId = messageId,
                sender = sender,
                body = body,
                receivedAt = receivedAt,
            )
        val fingerprint = createFingerprint(sender, body, receivedAt, amount)
        val category = inferCategory(rulePack, normalizedBody, merchantName)
        val paymentMethod = inferPaymentMethod(rulePack, normalizedBody)

        Log.d(
            "SMS_PARSER",
            "parsed sender=$sender amount=$amount merchant=$merchantName category=$category paymentMethod=$paymentMethod fingerprint=$fingerprint",
        )

        return ParseResult(
            SmsParsedMessage(
                fingerprint = fingerprint,
                sourceMessage = rawMessage,
                amount = amount,
                currency = rulePack.currencyCode,
                merchantName = merchantName,
                categorySuggestion = category,
                paymentMethodSuggestion = paymentMethod,
                noteSuggestion = merchantName?.let { "SMS import: $it" },
                transactionDate = receivedAt,
                matchedLocale = rulePack.localeTag,
                matchedPatternKey = "${rulePack.patternKeyPrefix}.generic.transaction",
            ),
            null,
        )
    }

    private fun parseAmount(
        rulePack: SmsRulePack,
        body: String,
    ): Double? {
        val match = rulePack.amountPattern.find(body) ?: return null
        return match.groupValues
            .getOrNull(1)
            ?.replace(",", "")
            ?.toDoubleOrNull()
    }

    private fun inferMerchant(
        rulePack: SmsRulePack,
        body: String,
    ): String? {
        for (pattern in rulePack.merchantPatterns) {
            val match = pattern.find(body)
            if (match != null) {
                val merchant =
                    match.groupValues
                        .getOrNull(1)
                        ?.replace(Regex("\\s+"), " ")
                        ?.trim()
                        ?.takeIf { it.isNotEmpty() }
                if (merchant != null) return merchant
            }
        }

        return null
    }

    private fun inferCategory(
        rulePack: SmsRulePack,
        body: String,
        merchantName: String?,
    ): String {
        val normalizedContent =
            listOfNotNull(merchantName, body)
                .joinToString(separator = " ")
                .trim()
                .lowercase(Locale.ROOT)

        if (normalizedContent.isEmpty()) {
            return "Other"
        }

        return rulePack.categoryInferenceRules
            .firstOrNull { (_, pattern) ->
                pattern.containsMatchIn(normalizedContent)
            }?.first ?: "Other"
    }

    private fun inferPaymentMethod(
        rulePack: SmsRulePack,
        body: String,
    ): SmsPaymentMethod? =
        rulePack.paymentMethodHints
            .firstOrNull { (_, pattern) -> pattern.containsMatchIn(body) }
            ?.let { (type, _) -> SmsPaymentMethod(type = type) }

    private fun isNegativeBankAlert(
        rulePack: SmsRulePack,
        body: String,
    ): Boolean {
        val hasDebitSignal =
            rulePack.debitKeywords.containsMatchIn(body) && !rulePack.creditOnlyKeywords.containsMatchIn(body)
        val hasSettledDebitSignal =
            rulePack.settledDebitKeywords.containsMatchIn(body) && !rulePack.creditOnlyKeywords.containsMatchIn(body)

        // Filter out declined/failed/reversed transactions
        if (rulePack.nonExpenseTransactionOutcomeKeywords.containsMatchIn(body)) return true

        // Filter out info-only messages (balance updates, card limits, etc.) when no debit signal
        if (!hasDebitSignal && rulePack.nonExpenseInfoKeywords.containsMatchIn(body)) return true

        // Filter out OTP/approval prompts ONLY when there's no settled debit signal
        // Banks often append "if not you" disclaimers to legitimate debit SMS — those should pass
        if (rulePack.approvalPromptKeywords.containsMatchIn(body) && !hasSettledDebitSignal) return true

        return false
    }

    private fun getTimeWindow(receivedAt: String): Long? {
        val timestamp =
            try {
                Instant.parse(receivedAt).toEpochMilli()
            } catch (_: Exception) {
                return null
            }

        val windowMs = 3 * 60 * 1000L
        return (timestamp / windowMs) * windowMs
    }

    private fun normalizeAmount(amount: Double?): String = amount?.let { String.format("%.2f", it) } ?: ""

    private fun sha256(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    fun createFingerprint(
        sender: String,
        body: String,
        receivedAt: String,
        amount: Double? = null,
    ): String {
        val normalizedSender = sender.replace(Regex("\\s+"), " ").trim().lowercase(Locale.ROOT)
        val normalizedBody =
            normalizeUnicode(body)
                .replace(Regex("\\s+"), " ")
                .trim()
                .lowercase(Locale.ROOT)
        val normalizedAmount = normalizeAmount(amount)
        val timeWindow = getTimeWindow(receivedAt)?.toString() ?: "no-window"
        val key = "$normalizedSender|$normalizedAmount|$timeWindow|$normalizedBody"
        return "sms_${sha256(key)}"
    }
}
